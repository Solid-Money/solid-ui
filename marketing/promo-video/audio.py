import numpy as np, wave, os, sys
OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'build','bed.wav')
os.makedirs(os.path.dirname(OUT),exist_ok=True)
SR=44100; DUR=37.6
N=int(SR*DUR); t=np.arange(N)/SR
L=np.zeros(N); R=np.zeros(N)

def env(start,dur,a=0.005,d=None,sus=0.0,curve=3.0):
    """exp-ish AD envelope as a full-length array slice helper"""
    i0=int(start*SR); n=int(dur*SR)
    if i0>=N: return None,None,None
    n=min(n,N-i0)
    e=np.zeros(n); k=int(a*SR)+1
    e[:k]=np.linspace(0,1,k)[:n]
    if n>k:
        e[k:]=np.exp(-np.linspace(0,curve,n-k))*(1-sus)+sus
    return i0,n,e

def add(buf,start,sig):
    i0=int(start*SR); n=len(sig)
    if i0>=N: return
    n=min(n,N-i0)
    buf[i0:i0+n]+=sig[:n]

def lp(x,cut):
    c=np.asarray(cut,dtype=float)
    a=np.full(len(x),np.exp(-2*np.pi*float(c)/SR)) if c.ndim==0 else np.exp(-2*np.pi*c/SR)
    y=np.empty(len(x),dtype=float); acc=0.0
    for i in range(len(x)):
        acc=a[i]*acc+(1-a[i])*x[i]; y[i]=acc
    return y

def hp(x,cut): return x-lp(x,cut)

rng=np.random.default_rng(7)

def note(f,dur,amp,partials=(1,.34,.16,.07),det=0.004,a=0.02,curve=2.6):
    n=int(dur*SR); tt=np.arange(n)/SR
    s=np.zeros(n)
    for k,w in enumerate(partials,1):
        s+=w*np.sin(2*np.pi*f*k*tt)
        s+=w*0.6*np.sin(2*np.pi*f*k*(1+det)*tt+0.7)
    e=np.zeros(n); k2=int(a*SR)+1
    e[:k2]=np.linspace(0,1,k2)[:n]
    if n>k2: e[k2:]=np.exp(-np.linspace(0,curve,n-k2))
    return s*e*amp/len(partials)

# ---- chord progression: Am - F - C - G, 2s each (120bpm, 4 beats/chord) ----
NOTE={'A2':110.0,'C3':130.81,'E3':164.81,'F2':87.31,'A3':220.0,'C4':261.63,
      'G2':98.0,'B3':246.94,'D4':293.66,'E4':329.63,'G4':392.0,'F3':174.61}
PROG=[('A2',['A3','C4','E4']),('F2',['A3','C4','F3']),
      ('C3',['C4','E4','G4']),('G2',['B3','D4','G4'])]

CHORD_LEN=2.0
nch=int(np.ceil(DUR/CHORD_LEN))
for i in range(nch):
    st=i*CHORD_LEN
    root,voices=PROG[i%4]
    # sparse in the intro, full body once the phone appears
    body=0.30 if st<3.0 else 1.0
    # pad
    for v in voices:
        s=note(NOTE[v],CHORD_LEN*1.5,0.052*body,partials=(1,.22,.09),a=0.35,curve=1.5)
        add(L,st,s*0.95); add(R,st,np.roll(s,180)*0.95)
    # sub root
    sub=note(NOTE[root]/2.0,CHORD_LEN*1.05,0.30*body,partials=(1,.10),a=0.06,curve=1.9)
    add(L,st,sub); add(R,st,sub)

# ---- beat: soft kick + ticks ----
BEAT=0.5
b=3.0
bi=0
while b<34.0:
    # kick
    n=int(0.26*SR); tt=np.arange(n)/SR
    f=45+45*np.exp(-tt*40)
    k=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*13)*0.34
    add(L,b,k); add(R,b,k)
    # tick on off-beats
    if bi%2==1:
        n2=int(0.05*SR)
        tk=hp(rng.normal(0,1,n2),5200)*np.exp(-np.linspace(0,7,n2))*0.020
        add(L,b,tk*0.8); add(R,b,tk)
    bi+=1; b+=BEAT

# ---- whoosh transitions on the actual cut points ----
CUTS=[3.2,7.8,13.4,16.4,21.3,24.2,27.5,29.4]
for c in CUTS:
    n=int(0.85*SR); tt=np.arange(n)/SR
    nz=rng.normal(0,1,n)
    sw=lp(hp(nz,300+2600*tt/tt[-1]),1200+5200*tt/tt[-1])
    e=np.exp(-((tt-0.22)/0.20)**2)
    w=sw*e*0.085
    add(L,c-0.30,w); add(R,c-0.30,np.roll(w,120))

# ---- riser into the outro ----
n=int(1.7*SR); tt=np.arange(n)/SR; p=tt/tt[-1]
nz=rng.normal(0,1,n)
ris=lp(hp(nz,400+3000*p),900+9000*p)*(p**2)*0.10
tone=np.sin(2*np.pi*np.cumsum(220+520*p**2)/SR)*(p**3)*0.055
add(L,32.3,ris+tone); add(R,32.3,ris*0.9+tone)

# ---- outro impact ----
n=int(2.2*SR); tt=np.arange(n)/SR
f=62*np.exp(-tt*1.1)+34
boom=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*1.7)*0.42
add(L,34.0,boom); add(R,34.0,boom)
n2=int(1.1*SR); tt2=np.arange(n2)/SR
spl=lp(hp(rng.normal(0,1,n2),1800),9000)*np.exp(-tt2*4.2)*0.055
add(L,34.0,spl); add(R,34.0,np.roll(spl,200))

# resolve chord on the outro
for v in ['A3','C4','E4','A2']:
    s=note(NOTE[v],3.6,0.075,partials=(1,.24,.10),a=0.25,curve=1.1)
    add(L,34.0,s); add(R,34.0,np.roll(s,220))

# ---- master: gentle stereo widen, fade in/out, soft limit ----
def master(x):
    x=x.copy()
    fi=int(0.7*SR); x[:fi]*=np.linspace(0,1,fi)
    f0=int(36.85*SR); f1=int(37.55*SR)
    x[f0:f1]*=np.linspace(1,0,f1-f0); x[f1:]=0
    x=np.tanh(x*1.15)*0.90
    return x
L=master(L); R=master(R)
peak=max(np.abs(L).max(),np.abs(R).max())
L/=peak/0.94; R/=peak/0.94

out=np.empty(N*2)
out[0::2]=L; out[1::2]=R
data=(np.clip(out,-1,1)*32767).astype('<i2').tobytes()
w=wave.open(OUT,'wb')
w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data); w.close()
print('wrote %s  %.1fs  peak=%.3f rms=%.4f'%(OUT,DUR,peak,float(np.sqrt((L**2).mean()))))
