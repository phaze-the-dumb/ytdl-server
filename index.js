const ytdl = require('./ytdl-quick.js');
const fs = require('fs');
const express = require('express');
const app = express();

if(!fs.existsSync('finished'))fs.mkdirSync('finished');

let inProgress = [];
let stream = ( req, res ) => {
    let path = 'finished/'+req.params.id+'.mp4';

    fs.stat(path, (err, stat) => {
        if (err !== null && err.code === 'ENOENT') {
            res.sendStatus(404);
            return;
        }

        const fileSize = stat.size
        const range = req.headers.range

        if (range) {

            const parts = range.replace(/bytes=/, "").split("-");

            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
            
            const chunksize = (end-start)+1;
            const file = fs.createReadStream(path, {start, end});
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            }
            
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            }

            res.writeHead(200, head);
            fs.createReadStream(path).pipe(res);
        }
    });
}

app.all('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
})

// Doesn't support firefox
app.get('/v/:id', async (req, res) => {
    console.log('Video Request')

    if(fs.existsSync('finished/'+req.params.id+'.mp4') && !inProgress.find(x => x === req.params.id)){
        console.log('Video Exists In Cache')
        stream(req, res);
    } else{
        res.status(404).send('Not Found');
    }
})

// Does support firefox - just realised i never set content-type headers, probably why the original url didn't work in firefox...
app.get('/v/:id/vid.mp4', async (req, res) => {
    console.log('Video Request')

    if(fs.existsSync('finished/'+req.params.id+'.mp4') && !inProgress.find(x => x === req.params.id)){
        console.log('Video Exists In Cache')
        stream(req, res);
    } else{
        if(!inProgress.find(x => x === req.params.id)){
            inProgress.push(req.params.id);
            let dwn = new ytdl('https://youtube.com/watch?v='+req.params.id, { verbose: true, output: 'finished/'+req.params.id+'.mp4' });

            dwn.onend = () => {
                inProgress = inProgress.filter(x => x !== req.params.id);
                stream(req, res);
            }
        }
    }
})

app.listen(80);
