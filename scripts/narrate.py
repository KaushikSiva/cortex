"""Narrate the actual browser recording, retaining raw video and exact chapter times."""
import json,subprocess,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
media=root/'public/media';work=root/'.data/narration';work.mkdir(parents=True,exist_ok=True)
chapters=json.loads((media/'chapters.json').read_text())['chapters']
def run(args):subprocess.run(args,check=True)
inputs=[];filters=[];labels=[]
# Browser recording begins before the first chapter: detect that lead from the raw duration.
raw=media/'CORTEX-demo-raw.webm'
raw_duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(raw)]))
content_duration=json.loads((media/'chapters.json').read_text())['duration']
lead=max(0,raw_duration-content_duration)
for i,ch in enumerate(chapters):
 txt=work/f'{i}.txt';txt.write_text(ch['narration']);audio=work/f'{i}.aiff'
 run(['say','-v','Samantha','-r','175','-f',str(txt),'-o',str(audio)])
 inputs+=['-i',str(audio)];delay=round(ch['start']*1000)
 audio_duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(audio)]))
 end=chapters[i+1]['start'] if i+1<len(chapters) else content_duration
 tempo=max(1,audio_duration/max(1,end-ch['start']-.3))
 filters.append(f'[{i+1}:a]atempo={tempo:.4f},adelay={delay}|{delay},volume=0.9[a{i}]');labels.append(f'[a{i}]')
filters.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0,alimiter=limit=0.95[audio]')
run(['ffmpeg','-y','-ss',str(lead),'-i',str(raw),*inputs,'-filter_complex',';'.join(filters),'-map','0:v','-map','[audio]','-vf','scale=1728:1080,pad=1920:1080:(ow-iw)/2:0:color=0x101611','-c:v','libx264','-preset','medium','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-t',str(content_duration),'-movflags','+faststart','-metadata','title=CORTEX — synthetic acoustic fixtures, live MuJoCo prototype','-metadata','comment=Location reference photograph: 2017 Yerba Buena Gardens, Beyond My Ken, CC BY-SA 4.0. https://commons.wikimedia.org/wiki/File:2017_Yerba_Buena_Gardens_Martin_Luther_King,_Jr._Memorial.jpg ; https://creativecommons.org/licenses/by-sa/4.0/ . Scene footage is simulated; vocal profiles are synthetic fixtures; narration is generated.',str(media/'CORTEX-demo.mp4')])
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d}.{ms%1000:03d}'
vtt=['WEBVTT','','NOTE Stone reference: Beyond My Ken, 2017 Yerba Buena Gardens, CC BY-SA 4.0. https://commons.wikimedia.org/wiki/File:2017_Yerba_Buena_Gardens_Martin_Luther_King,_Jr._Memorial.jpg','']
for i,ch in enumerate(chapters):
 end=chapters[i+1]['start'] if i+1<len(chapters) else content_duration
 vtt += [f'{stamp(ch["start"])} --> {stamp(end)}',ch['narration'],'']
(media/'CORTEX-demo.vtt').write_text('\n'.join(vtt))
calm=next(c['start'] for c in chapters if c['sub'].startswith('CALM PROFILE'))+.25;urgent=next(c['start'] for c in chapters if 'URGENT PROFILE' in c['sub'])+.25
comparison=f'[0:v]split[x][y];[x]trim=start={calm}:duration=5.5,setpts=PTS-STARTPTS,scale=512:288:flags=lanczos[l];[y]trim=start={urgent}:duration=5.5,setpts=PTS-STARTPTS,scale=512:288:flags=lanczos[r];[l][r]hstack,fps=10,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer'
run(['ffmpeg','-y','-i',str(media/'CORTEX-demo.mp4'),'-filter_complex',comparison,'-loop','0',str(media/'demo.gif')])
print('Final MP4, VTT captions and GIF written to',media)
