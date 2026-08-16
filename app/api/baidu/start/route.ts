import { NextRequest, NextResponse } from "next/server";
import { getCredentials } from "../_lib";

export async function GET(request:NextRequest){
  const {appKey,appSecret}=getCredentials(request);
  if(!appKey||!appSecret)return NextResponse.redirect("https://pan.baidu.com/union");
  const origin=new URL(request.url).origin;
  const redirectUri=`${origin}/api/baidu/exchange`;
  const state=crypto.randomUUID().replaceAll("-","");
  const params=new URLSearchParams({response_type:"code",client_id:appKey,redirect_uri:redirectUri,scope:"basic,netdisk",display:"page",confirm_login:"1",state});
  const response=NextResponse.redirect("https://openapi.baidu.com/oauth/2.0/authorize?"+params);
  response.cookies.set("galaxy_baidu_oauth_state",state,{httpOnly:true,secure:true,sameSite:"none",path:"/",maxAge:600});
  response.headers.set("Cache-Control","private, no-store");
  return response;
}
