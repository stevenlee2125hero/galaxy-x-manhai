import { NextRequest, NextResponse } from "next/server";
import { BaiduToken, getCredentials, sameOrigin, setTokenCookie } from "../_lib";

async function exchangeCode(code:string,appKey:string,appSecret:string,redirectUri:string){
  const params=new URLSearchParams({grant_type:"authorization_code",code,client_id:appKey,client_secret:appSecret,redirect_uri:redirectUri});
  const tokenResponse=await fetch("https://openapi.baidu.com/oauth/2.0/token?"+params,{signal:AbortSignal.timeout(20000)});
  const data=await tokenResponse.json().catch(()=>({}));
  if(!tokenResponse.ok||!data.access_token)throw new Error(data.error_description||data.error||"授权失败");
  return {...data,expiresAt:Date.now()+Number(data.expires_in||2592000)*1000} as BaiduToken;
}

export async function GET(request:NextRequest){
  const url=new URL(request.url);
  const code=String(url.searchParams.get("code")||"").trim();
  const state=String(url.searchParams.get("state")||"");
  const savedState=request.cookies.get("galaxy_baidu_oauth_state")?.value||"";
  const {appKey,appSecret}=getCredentials(request);
  const destination=new URL("/?baidu=connected",url.origin);
  if(!appKey||!appSecret||!code||!state||state!==savedState)return NextResponse.redirect(new URL("/?baidu=authorization_failed",url.origin));
  try{
    const token=await exchangeCode(code,appKey,appSecret,`${url.origin}/api/baidu/exchange`);
    const response=NextResponse.redirect(destination);
    response.cookies.delete("galaxy_baidu_oauth_state");
    await setTokenCookie(response,token,appSecret);
    return response;
  }catch{
    return NextResponse.redirect(new URL("/?baidu=authorization_failed",url.origin));
  }
}

export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({error:"来源校验失败"},{status:403});
  const {appKey,appSecret}=getCredentials(request);
  if(!appKey||!appSecret)return NextResponse.json({error:"请先保存百度开放平台密钥"},{status:400});
  const body=await request.json().catch(()=>({}));
  const code=String(body.code||"").trim();
  if(!/^[A-Za-z0-9._-]{6,512}$/.test(code))return NextResponse.json({error:"授权码格式不正确"},{status:400});
  try{
    const token=await exchangeCode(code,appKey,appSecret,"oob");
    const response=NextResponse.json({ok:true,scope:token.scope||null});
    await setTokenCookie(response,token,appSecret);
    return response;
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"授权失败"},{status:400});
  }
}
