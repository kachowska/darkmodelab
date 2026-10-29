#!/usr/bin/env python3
"""Цифровой глитч для статичных кадров бренда (шапка, превью).
glitch.py in.png out.png --seed 7 --amount 1.0 --protect x0,y0,x1,y1 [...] --soft x0,y0,x1,y1 --soft-n 2 --zone x0,y0,x1,y1
Сдвиг полос + разъезд каналов, pixel-sort, блоки сжатия, сканлайны. protect — восстанавливается из оригинала (текст чистый);
soft — после восстановления получает soft-n аккуратных сдвигов с разъездом каналов (как глитч на логотипе)."""
import argparse, numpy as np
from PIL import Image
ap=argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--seed',type=int,default=1); ap.add_argument('--amount',type=float,default=1.0)
ap.add_argument('--protect',action='append',default=[]); ap.add_argument('--zone',default=None)
ap.add_argument('--soft',action='append',default=[]); ap.add_argument('--soft-n',type=int,default=2)
a=ap.parse_args(); rng=np.random.default_rng(a.seed)
im=np.asarray(Image.open(a.src).convert('RGB')).astype(np.int16); H,W,_=im.shape; out=im.copy()
P=[tuple(map(int,p.split(','))) for p in a.protect]
Z=tuple(map(int,a.zone.split(','))) if a.zone else (0,0,W,H)
def inprot(y0,y1): return any(not(y1<=p[1] or y0>=p[3]) for p in P)
# 1. полосы со сдвигом и разъездом каналов
for _ in range(int(38*a.amount)):
    h=int(rng.choice([3,5,8,14,22,40,70])); y=int(rng.integers(Z[1],max(Z[1]+1,Z[3]-h)))
    soft=inprot(y,y+h); dx=int(rng.integers(-1,2)*rng.integers(8,26 if soft else 180))
    if dx==0: continue
    x0,x1=Z[0],Z[2]
    band=out[y:y+h,x0:x1].copy(); band=np.roll(band,dx,axis=1)
    cs=int(rng.integers(3,9 if soft else 22))
    band[...,0]=np.roll(band[...,0],cs,axis=1); band[...,2]=np.roll(band[...,2],-cs,axis=1)
    out[y:y+h,x0:x1]=band
# 2. pixel sort: тянем яркие пиксели вправо в узких полосах
lum=out.mean(axis=2)
for _ in range(int(26*a.amount)):
    h=int(rng.integers(2,10)); y=int(rng.integers(Z[1],Z[3]-h))
    if inprot(y,y+h): continue
    x=int(rng.integers(Z[0],Z[2]-300)); L=int(rng.integers(120,520))
    seg=out[y:y+h,x:x+L]; key=seg.mean(axis=2)
    idx=np.argsort(-key,axis=1); out[y:y+h,x:x+L]=np.take_along_axis(seg,idx[...,None],axis=1)
# 3. блоки сжатия
for _ in range(int(40*a.amount)):
    b=int(rng.choice([16,32])); x=int(rng.integers(Z[0],Z[2]-b)); y=int(rng.integers(Z[1],Z[3]-b))
    if inprot(y,y+b): continue
    blk=out[y:y+b,x:x+b]; out[y:y+b,x:x+b]=(blk.reshape(-1,3).mean(0)*0.6+blk*0.4)
    if rng.random()<.4 and x>b*4:
        k=b*int(rng.integers(1,4)); out[y:y+b,x:x+b]=out[y:y+b,x-k:x-k+b].copy()
# 3b. защищённые зоны — из оригинала
for x0,y0,x1,y1 in P: out[y0:y1,x0:x1]=im[y0:y1,x0:x1]
# 3c. мягкий глитч на логотипе
for sx0,sy0,sx1,sy1 in [tuple(map(int,q.split(','))) for q in a.soft]:
    for _ in range(a.soft_n):
        h=int(rng.integers(6,16)); y=int(rng.integers(sy0,sy1-h)); dx=int(rng.choice([-1,1])*rng.integers(10,24)); cs=int(rng.integers(3,7))
        band=out[y:y+h,sx0:sx1].copy(); band=np.roll(band,dx,axis=1)
        band[...,0]=np.roll(band[...,0],cs,axis=1); band[...,2]=np.roll(band[...,2],-cs,axis=1); out[y:y+h,sx0:sx1]=band
# 4. сканлайны и зерно
out[::3]=out[::3]*0.93
out=out+rng.normal(0,5,out.shape)
Image.fromarray(np.clip(out,0,255).astype(np.uint8)).save(a.dst)
print('→',a.dst)
