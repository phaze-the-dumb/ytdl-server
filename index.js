const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const fs = require('fs');
const express = require('express');
const app = express();

if(!fs.existsSync('temp'))fs.mkdirSync('temp');
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

app.get('/v/:id', async (req, res) => {
    console.log('Video Request')

    if(fs.existsSync('finished/'+req.params.id+'.mp4') && !inProgress.find(x => x === req.params.id)){
        console.log('Video Exists In Cache')
        stream(req, res);
    } else{
        if(!inProgress.find(x => x === req.params.id)){
            inProgress.push(req.params.id);

            console.log('Checking Formats');
            let formats = await ytdl.getInfo('https://youtube.com/watch?v='+req.params.id);
            let format = 'highestvideo';

            if(formats.formats.find(x => x.itag === '137'))format = '137';
            if(formats.formats.find(x => x.itag === '248'))format = '248';

            console.log('Downloading Video');

            // Download Video
            ytdl('https://youtube.com/watch?v='+req.params.id, { quality: format }).pipe(fs.createWriteStream('temp/'+req.params.id+'.mp4')).on('finish', () => {
                console.log('Downloading Audio');

                // Download Audio
                ytdl('https://youtube.com/watch?v='+req.params.id, { quality: 'highestaudio' }).pipe(fs.createWriteStream('temp/'+req.params.id+'.mp3')).on('finish', () => {
                    console.log('Combining Video & Audio');

                    // Combine Both
                    let cmb = spawn(ffmpeg, [ '-i', 'temp/'+req.params.id+'.mp4', '-i', 'temp/'+req.params.id+'.mp3', '-c:v', 'copy', '-c:a', 'aac', 'finished/'+req.params.id+'.mp4' ]);

                    cmb.on('close', () => {
                        console.log('Finished Combining');
                        inProgress = inProgress.filter(x => x !== req.params.id);

                        fs.unlinkSync('temp/'+req.params.id+'.mp4');
                        fs.unlinkSync('temp/'+req.params.id+'.mp3');

                        stream(req, res);
                    });
                });
            });
        }
    }
})

app.listen(161);