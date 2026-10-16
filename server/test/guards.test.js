import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import express from "express";
import { once } from "node:events";
import { User } from "../src/models/User.js";
import { Donation } from "../src/models/Donation.js";
import { Notification } from "../src/models/Notification.js";
import { authenticate, authorize, createToken } from "../src/middleware/auth.js";
import { errorHandler } from "../src/middleware/error.js";
import authRoutes from "../src/routes/authRoutes.js";
import donationRoutes from "../src/routes/donationRoutes.js";
import deliveryRoutes from "../src/routes/deliveryRoutes.js";
import adminRoutes from "../src/routes/adminRoutes.js";
import notificationRoutes from "../src/routes/notificationRoutes.js";

// Real HTTP, JWT, validation and controllers; model operations are mocked.
// These tests verify guards and query predicates, not MongoDB concurrency.
test("HTTP security and validation guards (mocked database)", async t => {
  process.env.JWT_SECRET = "test-only-secret-longer-than-thirty-two-characters";
  const users = {};
  const sessions = {};
  let counter=1;
  for(const role of ["donor","ngo","volunteer","admin","pending"]) {
    const id=String(counter++).padStart(24,"0");
    users[id]={_id:id,role:role==="pending"?"ngo":role,name:"Test",
      verificationStatus:role==="ngo"?"verified":"pending",available:true,
      location:{type:"Point",coordinates:[74.2436,16.7336]},tokenVersion:0};
    sessions[role]=createToken(users[id]);
  }
  const originalFind = User.findById;
  User.findById = id => ({select:async()=>users[id] || null});
  t.after(()=>{User.findById=originalFind;});
  const app=express();
  app.use(express.json({limit:"100kb"}));
  app.use("/auth",authRoutes);
  app.use("/donations",donationRoutes);
  app.use("/deliveries",deliveryRoutes);
  app.use("/admin",adminRoutes);
  app.use("/notifications",notificationRoutes);
  app.use(errorHandler);
  const server=app.listen(0,"127.0.0.1");
  await once(server,"listening");
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  async function req(path, role, body, method="POST", raw) {
    const response=await fetch("http://127.0.0.1:"+server.address().port+path,{
      method, headers:{...(role?{Authorization:"Bearer "+(sessions[role]||role)}:{}),
        ...(body!==undefined||raw!==undefined?{"Content-Type":"application/json"}:{})},
      body:raw??(body===undefined?undefined:JSON.stringify(body))
    });
    return {status:response.status,...await response.json()};
  }
  await t.test("missing JWT returns 401",async()=>assert.equal((await req("/donations/mine",null,undefined,"GET")).status,401));
  await t.test("forged JWT returns 401",async()=>assert.equal((await req("/donations/mine","not-a-token",undefined,"GET")).status,401));
  await t.test("expired JWT returns 401",async()=>{
    const token=jwt.sign({tokenVersion:0},process.env.JWT_SECRET,{subject:"000000000000000000000001",issuer:"foodbridge-api",audience:"foodbridge-web",expiresIn:-1});
    assert.equal((await req("/donations/mine",token,undefined,"GET")).status,401);
  });
  await t.test("wrong JWT audience rejected",async()=>{
    const token=jwt.sign({tokenVersion:0},process.env.JWT_SECRET,{subject:"000000000000000000000001",issuer:"foodbridge-api",audience:"wrong",expiresIn:60});
    assert.equal((await req("/donations/mine",token,undefined,"GET")).status,401);
  });
  await t.test("revoked session rejected",async()=>{
    users["000000000000000000000001"].tokenVersion=1;
    assert.equal((await req("/donations/mine","donor",undefined,"GET")).status,401);
    users["000000000000000000000001"].tokenVersion=0;
  });
  await t.test("database failure stays 503 instead of logging out user",async()=>{
    User.findById=()=>({select:async()=>{throw Object.assign(new Error("private DB details"),{name:"MongoNetworkError"});}});
    const result=await req("/donations/mine","donor",undefined,"GET");
    assert.equal(result.status,503);assert.equal(JSON.stringify(result).includes("private DB details"),false);
    User.findById=id=>({select:async()=>users[id]});
  });
  await t.test("non-admin cannot list users",async()=>assert.equal((await req("/admin/users","donor",undefined,"GET")).status,403));
  await t.test("NGO cannot create a donation",async()=>assert.equal((await req("/donations","ngo",{})).status,403));
  await t.test("donor cannot accept a delivery",async()=>assert.equal((await req("/deliveries/000000000000000000000010/accept","donor")).status,403));
  await t.test("pending NGO cannot claim",async()=>assert.equal((await req("/donations/000000000000000000000010/claim","pending")).status,403));
  await t.test("invalid object ID rejected",async()=>assert.equal((await req("/donations/bad/claim","ngo")).status,400));
  await t.test("malformed JSON sanitized",async()=>{
    const r=await req("/auth/login",null,undefined,"POST",'{"secret":PRIVATE');
    assert.equal(r.status,400);assert.equal(r.message,"Invalid JSON request body.");
  });
  await t.test("oversized body rejected",async()=>assert.equal((await req("/auth/login",null,{x:"x".repeat(110000)})).status,413));
  const registration={name:"Test",email:"test@example.com",password:"TestPassword123",role:"donor",phone:"9876543210",address:"Test address",latitude:16.7,longitude:74.2};
  await t.test("public administrator signup rejected",async()=>assert.equal((await req("/auth/register",null,{...registration,role:"admin"})).status,400));
  await t.test("verification privilege injection rejected",async()=>assert.equal((await req("/auth/register",null,{...registration,verificationStatus:"verified"})).status,400));
  await t.test("punctuation-only phone rejected",async()=>assert.equal((await req("/auth/register",null,{...registration,phone:"-------"})).status,400));
  await t.test("password byte limit enforced",async()=>assert.equal((await req("/auth/register",null,{...registration,password:"é".repeat(40)})).status,400));
  const food={foodName:"Test meals",description:"A fictional donation for testing.",foodType:"cooked",quantity:10,unit:"portions",
    estimatedServings:10,preparedAt:new Date(Date.now()-60000).toISOString(),
    expiresAt:new Date(Date.now()+3600000).toISOString(),dietaryLabels:[],allergens:[],
    storageConditions:"Covered containers",pickupAddress:"Test pickup",latitude:16.7,longitude:74.2,safetyConfirmed:true};
  for(const [label,patch] of Object.entries({
    "negative quantity":{quantity:-1},"fractional servings":{estimatedServings:1.2},
    "invalid latitude":{latitude:100},"missing preparation":{preparedAt:null},
    "expired deadline":{expiresAt:new Date(0).toISOString()},"unchecked declaration":{safetyConfirmed:false},
    "status injection":{status:"delivered"}
  })) await t.test("reject "+label,async()=>{
    const r=await req("/donations","donor",{...food,...patch});
    assert.equal(r.status,400);assert.ok(r.details.length);
  });
  await t.test("checklist concern cannot be accepted",async()=>assert.equal((await req("/deliveries/000000000000000000000010/dispatch","volunteer",{packaging:"Test",storage:"Test",condition:"concern",accepted:true})).status,400));
  await t.test("rejection requires reason",async()=>assert.equal((await req("/deliveries/000000000000000000000010/dispatch","volunteer",{packaging:"Test",storage:"Test",condition:"concern",accepted:false})).status,400));
  await t.test("atomic claim filter includes availability and expiry",async()=>{
    const original=Donation.findOneAndUpdate;
    Donation.findOneAndUpdate=async(filter)=>{assert.equal(filter.status,"available");assert.ok(filter.expiresAt.$gt instanceof Date);return null;};
    try{assert.equal((await req("/donations/000000000000000000000010/claim","ngo")).status,409);}
    finally{Donation.findOneAndUpdate=original;}
  });
  await t.test("atomic accept requires claim destination and unassigned volunteer",async()=>{
    const original=Donation.findOneAndUpdate;
    Donation.findOneAndUpdate=async(filter)=>{
      assert.equal(filter.status,"claimed");assert.equal(filter["delivery.volunteer"],null);
      assert.equal(filter["claim.ngo"].$type,"objectId");
      assert.equal(filter["claim.destinationLocation.type"],"Point");return null;
    };
    try{assert.equal((await req("/deliveries/000000000000000000000010/accept","volunteer")).status,409);}
    finally{Donation.findOneAndUpdate=original;}
  });
  await t.test("atomic cancellation scoped to donor",async()=>{
    const original=Donation.findOneAndUpdate;
    Donation.findOneAndUpdate=async(filter)=>{
      assert.equal(filter.donor,"000000000000000000000001");
      assert.deepEqual(filter.status.$in,["available","claimed","assigned"]);return null;
    };
    try{assert.equal((await req("/donations/000000000000000000000010/cancel","donor",{reason:"Demo cancel"})).status,409);}
    finally{Donation.findOneAndUpdate=original;}
  });
  await t.test("notification updates scoped to requesting user",async()=>{
    const update=Notification.findOneAndUpdate,find=Notification.findOne;
    Notification.findOneAndUpdate=async(filter)=>{assert.equal(filter.user,"000000000000000000000002");return null;};
    Notification.findOne=async()=>null;
    try{assert.equal((await req("/notifications/000000000000000000000010/read","ngo",undefined,"PATCH")).status,404);}
    finally{Notification.findOneAndUpdate=update;Notification.findOne=find;}
  });
  await t.test("long rejection keeps full reason but bounds event/history text",async()=>{
    const original=Donation.findOneAndUpdate;
    Donation.findOneAndUpdate=async(filter,update)=>{
      assert.equal(filter["delivery.volunteer"],"000000000000000000000003");
      assert.equal(update.$set.rejectionReason.length,1000);
      assert.ok(update.$push.events.message.length<=500);
      assert.ok(update.$push.history.note.length<=1000);
      assert.equal(update.$set["delivery.dispatchChecklist"].completedBy,"000000000000000000000003");
      return {status:"rejected"};
    };
    try{assert.equal((await req("/deliveries/000000000000000000000010/dispatch","volunteer",{
      packaging:"Test",storage:"Test",condition:"concern",accepted:false,reason:"R".repeat(1000)
    })).status,200);}
    finally{Donation.findOneAndUpdate=original;}
  });
  await t.test("NGO cannot delete donor listing",async()=>{
    assert.equal((await req("/donations/000000000000000000000010","ngo",undefined,"DELETE")).status,403);
  });
  await t.test("deleting available food cancels atomically and keeps notification event",async()=>{
    const original=Donation.findOneAndUpdate;
    Donation.findOneAndUpdate=async(filter,update)=>{
      assert.equal(filter.donor,"000000000000000000000001");
      assert.equal(filter.status,"available");assert.equal(filter.donorDeletedAt,null);
      assert.equal(update.$set.status,"cancelled");assert.ok(update.$set.donorDeletedAt instanceof Date);
      assert.equal(update.$push.events.type,"cancelled");return {_id:filter._id};
    };
    try{assert.equal((await req("/donations/000000000000000000000010","donor",undefined,"DELETE")).status,200);}
    finally{Donation.findOneAndUpdate=original;}
  });
  await t.test("terminal deletion retains delivered status and denies active states",async()=>{
    const original=Donation.findOneAndUpdate;let calls=0;
    Donation.findOneAndUpdate=async(filter,update)=>{
      calls++;
      if(calls===1)return null;
      assert.deepEqual(filter.status.$in,["cancelled","expired","rejected","delivered"]);
      assert.equal(update.$set.status,undefined);assert.ok(update.$set.donorDeletedAt);
      return null;
    };
    try{assert.equal((await req("/donations/000000000000000000000010","donor",undefined,"DELETE")).status,409);assert.equal(calls,2);}
    finally{Donation.findOneAndUpdate=original;}
  });
  await t.test("notification delete cannot modify another user's inbox",async()=>{
    const original=Notification.findOneAndUpdate;
    Notification.findOneAndUpdate=async(filter,update)=>{
      assert.equal(filter.user,"000000000000000000000002");
      assert.equal(filter.deletedAt,null);assert.ok(update.$set.deletedAt instanceof Date);
      return null;
    };
    try{assert.equal((await req("/notifications/000000000000000000000010","ngo",undefined,"DELETE")).status,404);}
    finally{Notification.findOneAndUpdate=original;}
  });
  await t.test("mark unread checks owner and excludes deleted notifications",async()=>{
    const original=Notification.findOneAndUpdate;
    Notification.findOneAndUpdate=async(filter,update)=>{
      assert.equal(filter.user,"000000000000000000000002");
      assert.equal(filter.deletedAt,null);assert.equal(update.$set.readAt,null);
      return {readAt:null};
    };
    try{assert.equal((await req("/notifications/000000000000000000000010/unread","ngo",undefined,"PATCH")).status,200);}
    finally{Notification.findOneAndUpdate=original;}
  });
  await t.test("clear read preserves unread and other users' notifications",async()=>{
    const original=Notification.updateMany;
    Notification.updateMany=async(filter,update)=>{
      assert.equal(filter.user,"000000000000000000000002");
      assert.deepEqual(filter.readAt,{$ne:null});assert.equal(filter.deletedAt,null);
      assert.ok(update.$set.deletedAt);return {modifiedCount:2};
    };
    try{const r=await req("/notifications/read","ngo",undefined,"DELETE");assert.equal(r.status,200);assert.equal(r.updatedCount,2);}
    finally{Notification.updateMany=original;}
  });
  await t.test("invalid notification filter rejected",async()=>{
    assert.equal((await req("/notifications?state=invalid","ngo",undefined,"GET")).status,400);
  });

});
