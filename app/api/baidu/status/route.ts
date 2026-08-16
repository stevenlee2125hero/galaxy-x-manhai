import { NextRequest, NextResponse } from "next/server";
import { getCredentials, getValidToken, setTokenCookie } from "../_lib";

export async function GET(request:NextRequest){
  const {appKey,appSecret}=getCredentials(request);
  const session=await getValidToken(request);
  const response=NextResponse.json({configured:Boolean(appKey&&appSecret),connected:Boolean(session.token),scope:session.token?.scope||null,mode:"callback"});
  response.headers.set("Cache-Control","private, no-store, no-cache, must-revalidate");
  if(session.refreshed&&session.token)await setTokenCookie(response,session.token,appSecret);
  return response;
}
