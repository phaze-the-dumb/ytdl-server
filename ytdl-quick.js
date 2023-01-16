const ytdl = require('ytdl-core');
const ffmpegbin = require('ffmpeg-static');
const cp = require('child_process');
const readline = require('readline');

let toMB = i => (i / 1024 / 1024).toFixed(2);

class Downloader{
    constructor(url, opts = { verbose: false, output: 'out.mkv' }){
        this.opts = opts;
        this.logInterval;
        this.onend = () => {};

        this.tracking = {
            start: Date.now(),
            audio: { downloaded: 0, total: Infinity },
            video: { downloaded: 0, total: Infinity },
            merged: { frame: 0, speed: '0x', fps: 0 }
        }

        this.audio = ytdl(url, { quality: 'highestaudio' });
        this.video = ytdl(url, { quality: 'highestvideo' });

        let printProgress = () => {
            readline.cursorTo(process.stdout, 0);
            
            process.stdout.write(`Audio  | ${(this.tracking.audio.downloaded / this.tracking.audio.total * 100).toFixed(2)}% processed `);
            process.stdout.write(`(${toMB(this.tracking.audio.downloaded)}MB of ${toMB(this.tracking.audio.total)}MB).${' '.repeat(10)}\n`);
          
            process.stdout.write(`Video  | ${(this.tracking.video.downloaded / this.tracking.video.total * 100).toFixed(2)}% processed `);
            process.stdout.write(`(${toMB(this.tracking.video.downloaded)}MB of ${toMB(this.tracking.video.total)}MB).${' '.repeat(10)}\n`);
          
            process.stdout.write(`Merged | processing frame ${this.tracking.merged.frame} `);
            process.stdout.write(`(at ${this.tracking.merged.fps} fps => ${this.tracking.merged.speed}).${' '.repeat(10)}\n`);
          
            process.stdout.write(`running for: ${((Date.now() - this.tracking.start) / 1000 / 60).toFixed(2)} Minutes.`);
            readline.moveCursor(process.stdout, 0, -3);
        }

        this.audio.on('progress', (_, downloaded, total) => {
            this.tracking.audio = { downloaded, total }
        });

        this.video.on('progress', (_, downloaded, total) => {
            this.tracking.video = { downloaded, total }
        });

        let ffmpeg = cp.spawn(ffmpegbin, [
            '-loglevel', '8', '-hide_banner',
            '-progress', 'pipe:3',
            '-i', 'pipe:4',
            '-i', 'pipe:5',
            '-map', '0:a',
            '-map', '1:v',
            '-c:v', 'copy',
            this.opts.output,
        ], {
            cwd: __dirname,
            windowsHide: true,
            stdio: [
                'inherit', 'inherit', 'inherit',
                'pipe', 'pipe', 'pipe',
            ],
        })

        ffmpeg.on('close', () => {
            console.log('Done');
            this.onend();

            if(this.opts.verbose){
                process.stdout.write('\n\n\n\n');
                clearInterval(this.logInterval);
            }
        })

        ffmpeg.stdio[3].on('data', chunk => {
            if(!this.logInterval && this.opts.verbose)this.logInterval = setInterval(printProgress, 500);

            let lines = chunk.toString().trim().split('\n');
            let args = {};

            for(let l of lines){
                let [key, value] = l.split('=');
                args[key.trim()] = value.trim();
            }

            this.tracking.merged = args;
        })

        this.audio.pipe(ffmpeg.stdio[4]);
        this.video.pipe(ffmpeg.stdio[5]);
    }
}

module.exports = Downloader;