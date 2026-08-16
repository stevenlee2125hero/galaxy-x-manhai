import { NextRequest, NextResponse } from "next/server";
import { getValidToken, setTokenCookie } from "../_lib";

export async function GET(request:NextRequest){
  const session=await getValidToken(request);
  if(!session.token)return NextResponse.json({error:"百度网盘未连接"},{status:401});
  const directory=request.nextUrl.searchParams.get("dir")||"/";
  if(!directory.startsWith("/")||directory.includes("..")||directory.length>1000)return NextResponse.json({error:"目录格式不正确"},{status:400});
  const params=new URLSearchParams({method:"list",access_token:session.token.access_token,dir:directory,start:"0",limit:"1000",order:"time",desc:"1",web:"1"});
  const cloudResponse=await fetch("https://pan.baidu.com/rest/2.0/xpan/file?"+params,{signal:AbortSignal.timeout(25000)});
  const data=await cloudResponse.json().catch(()=>({}));
  if(!cloudResponse.ok||Number(data.errno||0)!==0)return NextResponse.json({error:data.errmsg||"读取目录失败",errno:data.errno},{status:400});
  const allowed=/\.(pdf|cbz|zip|rar|7z|jpg|jpeg|png|webp|gif)$/i;
  const items=(data.list||[]).filter((item:{isdir:number;server_filename:string})=>item.isdir===1||allowed.test(item.server_filename)).map((item:{fs_id:number;path:string;server_filename:string;size:number;isdir:number;server_mtime:number})=>({fs_id:String(item.fs_id),path:item.path,name:item.server_filename,size:item.size,isdir:item.isdir===1,mtime:item.server_mtime}));
  const response=NextResponse.json({dir:directory,items});
  if(session.refreshed)await setTokenCookie(response,session.token,session.appSecret);
  return response;
}
