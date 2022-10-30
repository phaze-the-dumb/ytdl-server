const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const fs = require('fs');
const express = require('express');
const app = express();

if(!fs.existsSync('temp'))fs.mkdirSync('temp');
if(!fs.existsSync('finished'))fs.mkdirSync('finished');

let inProgress = [];

app.all('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
})

app.get('/v/:id', async (req, res) => {
    console.log('Video Request')

    if(fs.existsSync('finished/'+req.params.id+'.mp4') && !inProgress.find(x => x === req.params.id)){
        console.log('Video Exists In Cache')
        let s = fs.createReadStream('finished/'+req.params.id+'.mp4')
        let data = ''
        let length = fs.readFileSync('finished/'+req.params.id+'.mp4').byteLength

        s.on('data', (chunk) => {
            res.write(chunk);

            data += chunk;
            console.log(((data.length / length) * 100) + '% Uploaded')
        });

        s.on('end', () => {
            res.end();
        })
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
                        inProgress = inProgress.filter(x => x !== req.params.id);

                        fs.unlinkSync('temp/'+req.params.id+'.mp4');
                        fs.unlinkSync('temp/'+req.params.id+'.mp3');

                        let s = fs.createReadStream('finished/'+req.params.id+'.mp4')
                        let data = ''
                        let length = fs.readFileSync('finished/'+req.params.id+'.mp4').byteLength

                        s.on('data', (chunk) => {
                            res.write(chunk);

                            data += chunk;
                            console.log(((data.length / length) * 100) + '% Uploaded')
                        });

                        s.on('end', () => {
                            res.end();
                        })
                    });
                });
            });
        }
    }
})

app.listen(8080);