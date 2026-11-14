export interface Vec3 {x:number;y:number;z:number}
export const v3=(x=0,y=0,z=0):Vec3=>({x,y,z});
export const add=(a:Vec3,b:Vec3):Vec3=>v3(a.x+b.x,a.y+b.y,a.z+b.z);
export const sub=(a:Vec3,b:Vec3):Vec3=>v3(a.x-b.x,a.y-b.y,a.z-b.z);
export const scale=(a:Vec3,s:number):Vec3=>v3(a.x*s,a.y*s,a.z*s);
export const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const cross=(a:Vec3,b:Vec3):Vec3=>v3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
export const mag=(a:Vec3)=>Math.hypot(a.x,a.y,a.z);
export const unit=(a:Vec3):Vec3=>{const m=mag(a);return m?scale(a,1/m):v3();};
export const G0_MPS2=9.80665;
