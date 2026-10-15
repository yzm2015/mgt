'use strict';
const cloud=require('wx-server-sdk'),handler=require('./handler');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
exports.main=async()=>handler.handle(cloud.getWXContext());
