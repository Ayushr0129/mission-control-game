"""Reproduce original instrumental scores; requires numpy and ffmpeg in cloud.
No third-party samples, melodies or recordings. Runtime needs neither tool.
"""
import subprocess
import wave
from pathlib import Path
import numpy as np
RATE=24000
DEST=Path(__file__).resolve().parents[1]/'assets/audio'
WORK=Path(__file__).resolve().parents[1]/'work/music'
WORK.mkdir(parents=True,exist_ok=True)
def compose(name,energetic):
    beat=.5 if energetic else .75
    length=64*beat
    song=np.zeros(round(length*RATE))
    def note(midi,start,duration,level,soft=False):
        n=round(duration*RATE);t=np.arange(n)/RATE
        f=440*2**((midi-69)/12)
        env=np.minimum(t/.06,1)*np.minimum((duration-t)/.12,1)
        env*=np.exp(-t*(1.8 if soft else 3.8)/duration)
        sound=np.sin(2*np.pi*f*t)+.22*np.sin(2*np.pi*f*2*t)+.08*np.sin(2*np.pi*f*3*t)
        at=round(start*RATE)
        # Wrap tails into the beginning for a continuous cyclic score.
        indices=(np.arange(n)+at)%len(song)
        np.add.at(song,indices,level*env*sound)
    chords=[[45,52,57,60],[41,48,53,57],[48,55,60,64],[43,50,55,59]]
    tune=[69,72,76,74,72,67,69,64,65,69,72,69,67,64,62,64]
    for bar in range(16):
        root=chords[(bar//2)%4]
        for key in root:note(key,bar*4*beat,4.4*beat,.035,True)
        note(root[0]-12,bar*4*beat,3.8*beat,.07,True)
        for step in range(8):
            note(root[step%4]+12,(bar*4+step*.5)*beat,.7*beat,.025 if energetic else .014)
        note(tune[bar],bar*4*beat,2.5*beat,.085)
        note(tune[(bar+3)%16],(bar*4+3)*beat,.9*beat,.045)
        if energetic:
            for pulse in range(4):
                start=(bar*4+pulse)*beat
                t=np.arange(round(.16*RATE))/RATE
                kick=np.sin(2*np.pi*(58*t+9*(1-np.exp(-t*35))))*np.exp(-t*30)*.08
                at=round(start*RATE);song[at:at+len(kick)]+=kick
    song=np.tanh(song*.95)
    peak=np.max(np.abs(song));song*=.75/max(peak,1e-6)
    path=WORK/(name+'.wav')
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE);w.writeframes((song*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(path),'-c:a','libmp3lame','-b:a','48k','-write_xing','1',str(DEST/(name+'.mp3'))],check=True)
    print(name,length,(DEST/(name+'.mp3')).stat().st_size)
if __name__=='__main__':
    compose('music_control',False)
    compose('music_horizon',True)
