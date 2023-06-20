#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const cwd = process.cwd();
const root = cwd;
  exts = ['.jpg', '.png'],
  max = 5200000; 
let list=[];
function moveFile(file, destinationPath) {
  try{
    let base = path.basename(file);
    let dest=path.resolve(destinationPath,`${base}`);
    let dir=path.resolve(destinationPath);
    if(fs.existsSync(dir)==false){
      fs.mkdirSync(dir);
    }
    fs.copyFileSync(file, dest);
    fs.unlinkSync(file);
  }catch(ex){
    console.error(ex);
  }
}


const options = {
  method: 'POST',
  hostname: 'tinypng.com',
  path: '/backend/opt/shrink',
  headers: {
    rejectUnauthorized: false,
    'Postman-Token': Date.now(),
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
  }
};
const agent='Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.{version}.87 Safari/537.36';
let version=1000;
console.log('=============开始作业==========')


function getRandomIP() {
  return Array.from(Array(4)).map(() => parseInt(Math.random() * 255)).join('.')
}

async function run(){
  const req=await fileList(root);
  if(req){
    if(list&&list.length>0){
      await runUpload();
      console.log('任务执行完成')
      await delay(2000);
      run();
    }
  }
}
// 获取文件列表
function fileList(folder) {
  list=[];
  return new Promise(resolve=>{
    fs.readdir(folder, (err, files) => {
      if (err) {
        console.error(err);
        resolve(false);
        return;
      }
      files.forEach(file => {
        fileFilter(path.join(folder, file));
      });
      console.log('检查到文件数量:'+list.length)
      resolve(true);
    });
  })

  
}

function delay(ms){
  return new Promise(resolve=>{
    setTimeout(resolve,ms);
  })
}
async function runUpload(){
  let idx=0;
  let taskCount=2;
  while(idx < list.length){
    let files=[];
    for(let i=idx;i<idx+taskCount;i++){
      if(list[i]){
        files.push( fileUpload(list[i]) );
      }
    }
    for(let task of files){
      task = await task;
    }
    await delay(2000);
    idx+=taskCount;
  }
  return true;

}


// 过滤文件格式，返回所有jpg,png图片
function fileFilter(file) {
  try{
    const stats = fs.statSync(file);
    if (
      // 必须是文件，小于5MB，后缀 jpg||png
      stats.isFile() &&
      exts.includes(path.extname(file))
    ) {
      if(stats.size <= max){
        list.push(file);
      }else{
        console.error(`\u001b[31m[${path.basename(file)}]超过5M,暂存到error文件夹下\u001b[0m`);
        moveFile(file,'error');
      }
    }
  }catch(err){
    if (err) return console.error(err);
  }
}

// 异步API,压缩图片
// {"error":"Bad request","message":"Request is invalid"}
// {"input": { "size": 887, "type": "image/png" },"output": { "size": 785, "type": "image/png", "width": 81, "height": 81, "ratio": 0.885, "url": "https://tinypng.com/web/output/7aztz90nq5p9545zch8gjzqg5ubdatd6" }}
function fileUpload(img) {
  return new Promise(resolve=>{
    options.headers['X-Forwarded-For'] = getRandomIP();
    options.headers['Postman-Token'] = Date.now();
    options.headers['User-Agent']=agent.replace('{version}',version++);

    // console.log(`开始上传:${path.basename(img)}`)
    
    var req = https.request(options, function(res) {
      res.on('data', buf => {
        let obj = JSON.parse(buf.toString());
        if (obj.error) {
          let imgName= path.basename(img);
          console.log(`\u001b[31m[${imgName}]：*********压缩失败！**********报错：${obj.message}\u001b[0m`);
          delay(2000).then(()=>{resolve(false);})
        } else {
          fileUpdate(img, obj).then((ret)=>{
            resolve(ret);
          });
        }
      });
    });
  
    req.write(fs.readFileSync(img), 'binary');
    req.on('error', e => {
      console.error(e);
      resolve(false)
    });
    req.end();
  })
  
  
}
// 该方法被循环调用,请求图片数据
function fileUpdate(imgpath, obj) {
  let sourceFile = imgpath;
  const outputDir = path.join(cwd , 'output');
  imgpath = path.join(cwd , 'output', imgpath.replace(cwd, ''));

  if(!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  let options = new URL(obj.output.url);
  return new Promise(resolve=>{
    let req = https.request(options, res => {
      let body = '';
      res.setEncoding('binary');
      res.on('data', function(data) {
        body += data;
      });
  
      res.on('end', function() {
        fs.writeFile(imgpath, body, 'binary', err => {
          if (err) {
            return console.error(err);
          }
          let imgName= path.basename(imgpath);
          console.log(
            `\u001b[32m[${imgName}] 优化比例-${obj.output.ratio}%\u001b[0m`
          );
          fs.unlinkSync(sourceFile);
          resolve(true);
        });
      });
    });
    req.on('error', e => {
      console.error(e);
      resolve(false);
    });
    req.end();
  })
  
}


run();