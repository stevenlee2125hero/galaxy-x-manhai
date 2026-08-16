import { NextRequest, NextResponse } from "next/server";
import { clearBaiduCookies, sameOrigin } from "../_lib";

export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({error:"来源校验失败"},{status:403});
  const response=NextResponse.json({ok:true});
  clearBaiduCookies(response);
  return response;
}
