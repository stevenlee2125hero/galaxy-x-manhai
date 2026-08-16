import { NextRequest, NextResponse } from "next/server";

export type BaiduToken = {
  access_token:string;
  refresh_token:string;
  expires_in:number;
  expiresAt:number;
  scope?:string;
};

export const cookieNames={
  key:"galaxy_baidu_key",
  secret:"galaxy_baidu_secret",
  token:"galaxy_baidu_token"
};

const cookieOptions={httpOnly:true,secure:true,sameSite:"none" as const,path:"/",maxAge:400*24*60*60};

function bytesToBase64Url(bytes:Uint8Array){
  let binary="";
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}

function base64UrlToBytes(value:string){
  const base64=value.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-value.length%4)%4);
  const binary=atob(base64);
  return Uint8Array.from(binary,character=>character.charCodeAt(0));
}

async function encryptionKey(secret:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}

export async function sealToken(token:BaiduToken,secret:string){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},await encryptionKey(secret),new TextEncoder().encode(JSON.stringify(token)));
  return bytesToBase64Url(iv)+"."+bytesToBase64Url(new Uint8Array(encrypted));
}

export async function openToken(value:string,secret:string){
  const [ivValue,cipherValue]=value.split(".");
  if(!ivValue||!cipherValue)return null;
  try{
    const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:base64UrlToBytes(ivValue)},await encryptionKey(secret),base64UrlToBytes(cipherValue));
    return JSON.parse(new TextDecoder().decode(decrypted)) as BaiduToken;
  }catch{return null;}
}

export function getCredentials(request:NextRequest){
  return {
    appKey:request.cookies.get(cookieNames.key)?.value||"",
    appSecret:request.cookies.get(cookieNames.secret)?.value||""
  };
}

export function getBaiduRedirectUri(request:NextRequest){
  const configured=process.env.BAIDU_REDIRECT_URI?.trim();
  if(configured){
    try{
      const url=new URL(configured);
      if(url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))return url.toString();
    }catch{}
  }
  const requestUrl=new URL(request.url);
  const forwardedHost=request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto=request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const origin=forwardedHost?`${forwardedProto||requestUrl.protocol.replace(":","")}://${forwardedHost}`:requestUrl.origin;
  return new URL("/api/baidu/exchange",origin).toString();
}

export function setCredentialCookies(response:NextResponse,appKey:string,appSecret:string){
  response.cookies.set(cookieNames.key,appKey,cookieOptions);
  response.cookies.set(cookieNames.secret,appSecret,cookieOptions);
}

export async function setTokenCookie(response:NextResponse,token:BaiduToken,appSecret:string){
  response.cookies.set(cookieNames.token,await sealToken(token,appSecret),cookieOptions);
}

export function clearBaiduCookies(response:NextResponse){
  for(const name of Object.values(cookieNames))response.cookies.set(name,"",{...cookieOptions,maxAge:0});
}

export function sameOrigin(request:NextRequest){
  const origin=request.headers.get("origin");
  return !origin||origin===new URL(request.url).origin;
}

export async function getValidToken(request:NextRequest){
  const {appKey,appSecret}=getCredentials(request);
  const sealed=request.cookies.get(cookieNames.token)?.value;
  if(!appKey||!appSecret||!sealed)return {token:null,appKey,appSecret,refreshed:false};
  const current=await openToken(sealed,appSecret);
  if(!current)return {token:null,appKey,appSecret,refreshed:false};
  if(current.expiresAt>Date.now()+5*60*1000)return {token:current,appKey,appSecret,refreshed:false};
  const params=new URLSearchParams({grant_type:"refresh_token",refresh_token:current.refresh_token,client_id:appKey,client_secret:appSecret});
  const response=await fetch("https://openapi.baidu.com/oauth/2.0/token?"+params,{signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  if(!response.ok||!data.access_token)return {token:null,appKey,appSecret,refreshed:false};
  const token:BaiduToken={...data,expiresAt:Date.now()+Number(data.expires_in||2592000)*1000};
  return {token,appKey,appSecret,refreshed:true};
}
