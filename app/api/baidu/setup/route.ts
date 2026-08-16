import { NextRequest, NextResponse } from "next/server";
import { sameOrigin, setCredentialCookies } from "../_lib";

export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({error:"来源校验失败"},{status:403});
  const body=await request.json().catch(()=>({}));
  const appKey=String(body.appKey||"").trim();
  const appSecret=String(body.appSecret||"").trim();
  if(!/^[A-Za-z0-9_-]{6,160}$/.test(appKey)||!/^[A-Za-z0-9_-]{6,200}$/.test(appSecret))return NextResponse.json({error:"AppKey 或 SecretKey 格式不正确"},{status:400});
  const response=NextResponse.json({ok:true});
  setCredentialCookies(response,appKey,appSecret);
  return response;
}
