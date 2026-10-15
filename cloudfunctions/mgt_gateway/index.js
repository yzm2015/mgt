'use strict';
const cloud=require('wx-server-sdk');
const handler=require('./handler');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const storage=require('./storage')(cloud.database());
storage.social=require('./social-storage')(cloud.database());
exports.main=async event=>handler.handle(event,cloud.getWXContext(),storage);
