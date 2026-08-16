import { NextRequest, NextResponse } from "next/server";
import { getValidToken, setTokenCookie } from "../_lib";

export async function GET(request:NextRequest){
  const session=await getValidToken(request);
  if(!session.token)return NextResponse.json({error:"百度网盘未连接"},{status:401});
  const fsId=request.nextUrl.searchParams.get("fs_id")||"";
  if(!/^\d{1,30}$/.test(fsId))return NextResponse.json({error:"文件编号无效"},{status:400});
  const params=new URLSearchParams({method:"filemetas",access_token:session.token.access_token,fsids:JSON.stringify([Number(fsId)]),dlink:"1",thumb:"0",extra:"1"});
  const metaResponse=await fetch("https://pan.baidu.com/rest/2.0/xpan/multimedia?"+params,{signal:AbortSignal.timeout(25000)});
  const data=await metaResponse.json().catch(()=>({}));
  const dlink=data.list?.[0]?.dlink;
  if(!metaResponse.ok||!dlink)return NextResponse.json({error:data.errmsg||"无法获取下载地址"},{status:400});
  const url=new URL(dlink);
  if(!url.searchParams.has("access_token"))url.searchParams.set("access_token",session.token.access_token);
  const response=NextResponse.redirect(url);
  response.headers.set("Referrer-Policy","no-referrer");
  if(session.refreshed)await setTokenCookie(response,session.token,session.appSecret);
  return response;
}
