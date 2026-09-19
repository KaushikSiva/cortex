"""Narrate the actual browser recording, retaining raw video and exact chapter times."""
import argparse,json,subprocess,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--voice',default='Samantha')
parser.add_argument('--rate',type=int,default=175)
parser.add_argument('--chapters',default='chapters.json')
parser.add_argument('--output',default='CORTEX-demo')
parser.add_argument('--skip-gif',action='store_true')
args=parser.parse_args()
if pathlib.Path(args.output).name!=args.output: parser.error('--output must be a file stem, not a path')
media=root/'public/media';work=root/'.data/narration'/args.output;work.mkdir(parents=True,exist_ok=True)
manifest=json.loads((media/args.chapters).read_text());chapters=manifest['chapters']
measurements=[]
def run(args):subprocess.run(args,check=True)
inputs=[];filters=[];labels=[]
# Browser recording begins before the first chapter: detect that lead from the raw duration.
raw=media/'CORTEX-demo-raw.webm'
raw_duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(raw)]))
content_duration=manifest['duration']
lead=max(0,raw_duration-content_duration)
for i,ch in enumerate(chapters):
 txt=work/f'{i}.txt';txt.write_text(ch['narration']);audio=work/f'{i}.aiff'
 run(['say','-v',args.voice,'-r',str(args.rate),'-f',str(txt),'-o',str(audio)])
 inputs+=['-i',str(audio)];delay=round(ch['start']*1000)
 audio_duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(audio)]))
 end=chapters[i+1]['start'] if i+1<len(chapters) else content_duration
 tempo=max(1,audio_duration/max(1,end-ch['start']-.3))
 filters.append(f'[{i+1}:a]atempo={tempo:.4f},adelay={delay}|{delay}[a{i}]');labels.append(f'[a{i}]')
 measurements.append({'chapter':ch['title'],'start':ch['start'],'sourceAudioSeconds':audio_duration,'tempo':tempo,'spokenEnd':ch['start']+audio_duration/tempo,'chapterEnd':end})
filters.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[audio]')
run(['ffmpeg','-hide_banner','-loglevel','warning','-y','-ss',str(lead),'-i',str(raw),*inputs,'-filter_complex',';'.join(filters),'-map','0:v','-map','[audio]','-vf','scale=1728:1080,pad=1920:1080:(ow-iw)/2:0:color=0x101611','-c:v','libx264','-preset','medium','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-t',str(content_duration),'-movflags','+faststart','-metadata','title=CORTEX — synthetic acoustic fixtures, live MuJoCo prototype','-metadata','comment=Authored Painted Ladies architecture; not a surveyed reconstruction. Hidden reference scan by jtressle, CC BY 4.0. https://sketchfab.com/3d-models/san-francisco-painted-ladies-cf5aeb7fb0ac4152b43f72ce1dac60d6 ; https://creativecommons.org/licenses/by/4.0/ . Runtime transform and sky filtering. Simulated robot; synthetic vocal fixtures; generated narration.',str(media/(args.output+'.mp4'))])
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d}.{ms%1000:03d}'
vtt=['WEBVTT','','NOTE Hidden reference scan: jtressle, CC BY 4.0. https://sketchfab.com/3d-models/san-francisco-painted-ladies-cf5aeb7fb0ac4152b43f72ce1dac60d6','']
for i,ch in enumerate(chapters):
 end=chapters[i+1]['start'] if i+1<len(chapters) else content_duration
 vtt += [f'{stamp(ch["start"])} --> {stamp(end)}',ch['narration'],'']
(media/(args.output+'.vtt')).write_text('\n'.join(vtt))
(media/(args.output+'-narration.json')).write_text(json.dumps({'voice':args.voice,'locale':manifest.get('narration',{}).get('locale'),'generated':True,'source':'CORTEX-demo-raw.webm','duration':content_duration,'chapters':measurements},indent=2)+'\n')
if args.skip_gif:
 print('Video and captions written:',media/(args.output+'.mp4'));raise SystemExit(0)
calm=next(c['start'] for c in chapters if c['sub'].startswith('CALM PROFILE'))+.25;urgent=next(c['start'] for c in chapters if 'URGENT PROFILE' in c['sub'])+.25
comparison=f'[0:v]split[x][y];[x]trim=start={calm}:duration=5.5,setpts=PTS-STARTPTS,scale=512:288:flags=lanczos[l];[y]trim=start={urgent}:duration=5.5,setpts=PTS-STARTPTS,scale=512:288:flags=lanczos[r];[l][r]hstack,fps=10,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer'
run(['ffmpeg','-hide_banner','-loglevel','warning','-y','-i',str(media/(args.output+'.mp4')),'-filter_complex',comparison,'-loop','0',str(media/'demo.gif')])
print('Final MP4, VTT captions and GIF written to',media)
