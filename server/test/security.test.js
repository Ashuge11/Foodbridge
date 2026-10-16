import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import express from "express";
import { createServer } from "node:http";
import { User } from "../src/models/User.js";
import { Donation } from "../src/models/Donation.js";
import { Notification } from "../src/models/Notification.js";
import { processNotifications } from "../src/services/notificationService.js";
import { errorHandler } from "../src/middleware/error.js";
import authRoutes from "../src/routes/authRoutes.js";
import donationRoutes from "../src/routes/donationRoutes.js";
import deliveryRoutes from "../src/routes/deliveryRoutes.js";
import adminRoutes from "../src/routes/adminRoutes.js";
import notificationRoutes from "../src/routes/notificationRoutes.js";

// Dedicated disposable standalone database. Never reads .env or uses Atlas.
test("FoodBridge authorization, validation, workflow and notification integration", { timeout: 180000 }, async t => {
  process.env.JWT_SECRET = "isolated-test-secret-at-least-32-characters";
  const mongo = await MongoMemoryServer.create();
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri("foodbridge_test"));
  await Promise.all([User.init(), Donation.init(), Notification.init()]);
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/donations", donationRoutes);
  app.use("/api/deliveries", deliveryRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use(errorHandler);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  async function request(path, { method = "GET", body, token, raw } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body))
    });
    return { status: response.status, ...(await response.json()) };
  }
  const registration = (email, role) => ({
    email, role, name: "Test account", password: "TestPassword123!",
    phone: "9876543210", address: "Test address Kolhapur",
    latitude: 16.73364, longitude: 74.24360,
    organizationName: "Test organization", registrationNumber: "TEST-01",
    organizationDescription: "Fictional organization for automated testing."
  });
  let donor, donor2, ngo, ngo2, pending, volunteer, volunteer2, admin;
  await t.test("register normal users; passwords and session version are private", async () => {
    const accounts = [];
    for (const [email, role] of [
      ["donor@test.example","donor"],["donor2@test.example","donor"],
      ["ngo@test.example","ngo"],["ngo2@test.example","ngo"],["pending@test.example","ngo"],
      ["volunteer@test.example","volunteer"],["volunteer2@test.example","volunteer"]
    ]) {
      const result = await request("/auth/register",{method:"POST",body:registration(email,role)});
      assert.equal(result.status,201,JSON.stringify(result));
      assert.equal(result.user.password,undefined);
      assert.equal(result.user.tokenVersion,undefined);
      accounts.push(result);
    }
    [donor,donor2,ngo,ngo2,pending,volunteer,volunteer2] = accounts;
    const fields = registration("admin@test.example","admin");
    await User.create({...fields,location:{type:"Point",coordinates:[fields.longitude,fields.latitude]},
      verificationStatus:"not_required"});
    admin = await request("/auth/login",{method:"POST",body:{email:fields.email,password:fields.password}});
    assert.equal(admin.status,200);
  });
  await t.test("public admin registration and verification injection are rejected",async()=>{
    for(const body of [registration("bad@test.example","admin"),
      {...registration("bad@test.example","ngo"),verificationStatus:"verified"}]){
      assert.equal((await request("/auth/register",{method:"POST",body})).status,400);
    }
  });
  await t.test("duplicate email, invalid phone, oversized password, malformed JSON",async()=>{
    assert.equal((await request("/auth/register",{method:"POST",body:registration("donor@test.example","donor")})).status,409);
    assert.equal((await request("/auth/register",{method:"POST",body:{...registration("bad@test.example","donor"),phone:"-------"}})).status,400);
    assert.equal((await request("/auth/login",{method:"POST",body:{email:"donor@test.example",password:"x".repeat(73)}})).status,400);
    const malformed=await request("/auth/login",{method:"POST",raw:'{"password":SECRET'});
    assert.equal(malformed.status,400);assert.equal(malformed.message,"Invalid JSON request body.");
    assert.equal(JSON.stringify(malformed).includes("SECRET"),false);
    assert.equal((await request("/auth/login",{method:"POST",raw:JSON.stringify({x:"x".repeat(110000)})})).status,413);
  });
  await t.test("missing/invalid JWT, non-admin access and protected profile",async()=>{
    assert.equal((await request("/auth/me")).status,401);
    assert.equal((await request("/auth/me",{token:"invalid"})).status,401);
    assert.equal((await request("/admin/users",{token:donor.token})).status,403);
    assert.equal((await request("/auth/me",{token:donor.token})).user.role,"donor");
  });
  await t.test("only admin reviews NGOs; rejection requires reason; repeat review conflicts",async()=>{
    assert.equal((await request("/admin/ngos/"+ngo.user._id+"/verify",{method:"PATCH",token:donor.token,body:{decision:"verified"}})).status,403);
    assert.equal((await request("/admin/ngos/"+pending.user._id+"/verify",{method:"PATCH",token:admin.token,body:{decision:"rejected",reason:""}})).status,400);
    for(const n of [ngo,ngo2]){
      assert.equal((await request("/admin/ngos/"+n.user._id+"/verify",{method:"PATCH",token:admin.token,body:{decision:"verified"}})).status,200);
    }
    assert.equal((await request("/admin/ngos/"+ngo.user._id+"/verify",{method:"PATCH",token:admin.token,body:{decision:"verified"}})).status,409);
  });
  const food = () => ({
    foodName:"[DEMO] Test Meals",description:"Fictional food for automated tests.",
    foodType:"cooked",quantity:10,unit:"portions",estimatedServings:10,
    preparedAt:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+7200000).toISOString(),
    dietaryLabels:["vegetarian"],allergens:[],storageConditions:"Test sealed containers",
    pickupAddress:"Test pickup in Kolhapur",latitude:16.73364,longitude:74.24360,safetyConfirmed:true
  });
  async function create() {
    const result=await request("/donations",{method:"POST",token:donor.token,body:food()});
    assert.equal(result.status,201,JSON.stringify(result));return result.donation;
  }
  let listing;
  await t.test("food fields validated server-side and role enforced",async()=>{
    for(const patch of [{quantity:-1},{estimatedServings:1.5},{latitude:91},{safetyConfirmed:false},
      {preparedAt:null},{expiresAt:new Date(Date.now()-1000).toISOString()},{status:"delivered"}]){
      const result=await request("/donations",{method:"POST",token:donor.token,body:{...food(),...patch}});
      assert.equal(result.status,400,JSON.stringify(patch));
      assert.ok(result.details?.length);
    }
    assert.equal((await request("/donations",{method:"POST",token:ngo.token,body:food()})).status,403);
    listing=await create();
  });
  await t.test("only owner edits/cancels, stale revision conflicts, private delivery details",async()=>{
    assert.equal((await request("/donations/"+listing._id,{method:"PATCH",token:donor2.token,body:{...food(),revision:0}})).status,409);
    assert.equal((await request("/donations/"+listing._id+"/cancel",{method:"POST",token:donor2.token,body:{reason:"test cancel"}})).status,409);
    assert.equal((await request("/deliveries/"+listing._id,{token:ngo.token})).status,404);
    assert.equal((await request("/donations/"+listing._id,{method:"PATCH",token:donor.token,body:{...food(),revision:0}})).status,200);
    assert.equal((await request("/donations/"+listing._id,{method:"PATCH",token:donor.token,body:{...food(),revision:0}})).status,409);
    assert.equal((await request("/donations/bad/claim",{method:"POST",token:ngo.token})).status,400);
  });
  await t.test("matching offers reach verified nearby NGOs, never pending NGOs",async()=>{
    await processNotifications();
    assert.ok(await Notification.exists({donation:listing._id,user:ngo.user._id,type:"created"}));
    assert.ok(await Notification.exists({donation:listing._id,user:ngo2.user._id,type:"created"}));
    assert.equal(await Notification.exists({donation:listing._id,user:pending.user._id}),null);
  });
  await t.test("availability and unclaimed pickup protection",async()=>{
    assert.equal((await request("/deliveries/"+listing._id+"/accept",{method:"POST",token:volunteer.token})).status,403);
    for(const v of [volunteer,volunteer2]){
      assert.equal((await request("/deliveries/availability",{method:"PATCH",token:v.token,body:{
        available:true,address:"Test volunteer Kolhapur",latitude:16.73364,longitude:74.24360
      }})).status,200);
    }
    assert.equal((await request("/deliveries/"+listing._id+"/accept",{method:"POST",token:volunteer.token})).status,409);
    assert.equal((await request("/deliveries/requests",{token:volunteer.token})).deliveries.length,0);
  });
  let winner,other,carrier,otherCarrier;
  await t.test("pending NGO cannot claim; exactly one concurrent claim succeeds",async()=>{
    assert.equal((await request("/donations/"+listing._id+"/claim",{method:"POST",token:pending.token})).status,403);
    const results=await Promise.all([ngo,ngo2].map(n=>request("/donations/"+listing._id+"/claim",{method:"POST",token:n.token})));
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    [winner,other]=results[0].status===200?[ngo,ngo2]:[ngo2,ngo];
    await processNotifications();
    assert.equal((await Notification.findOne({user:other.user._id,donation:listing._id,type:"claimed"})).title,"Food no longer available");
    assert.equal((await Notification.findOne({user:volunteer.user._id,donation:listing._id,type:"claimed"})).title,"New pickup request available");
  });
  await t.test("exactly one concurrent volunteer assignment succeeds",async()=>{
    const results=await Promise.all([volunteer,volunteer2].map(v=>request("/deliveries/"+listing._id+"/accept",{method:"POST",token:v.token})));
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    [carrier,otherCarrier]=results[0].status===200?[volunteer,volunteer2]:[volunteer2,volunteer];
  });
  const checklist={packaging:"Demo sealed containers",storage:"Demo covered storage",condition:"acceptable",accepted:true,reason:"",notes:"No real food inspected."};
  await t.test("workflow order, checklist validation and assigned participant enforced",async()=>{
    const action=(suffix,token,body)=>request("/deliveries/"+listing._id+"/"+suffix,{method:"POST",token,body});
    assert.equal((await action("pickup",carrier.token)).status,409);
    assert.equal((await action("dispatch",otherCarrier.token,checklist)).status,409);
    assert.equal((await action("dispatch",carrier.token,{...checklist,condition:"concern"})).status,400);
    assert.equal((await action("dispatch",carrier.token,{...checklist,accepted:false,reason:""})).status,400);
    assert.equal((await action("dispatch",carrier.token,{...checklist,completedBy:other.user._id})).status,400);
    assert.equal((await action("dispatch",carrier.token,checklist)).donation.status,"dispatched");
    assert.equal((await request("/donations/"+listing._id+"/cancel",{method:"POST",token:donor.token,body:{reason:"Too late"}})).status,409);
    assert.equal((await action("pickup",carrier.token)).donation.status,"picked_up");
    assert.equal((await action("handover",carrier.token,checklist)).donation.status,"handover_pending");
    assert.equal((await action("receive",other.token,checklist)).status,409);
    const delivered=await action("receive",winner.token,checklist);
    assert.equal(delivered.donation.status,"delivered");
    assert.equal(String(delivered.donation.delivery.receiptChecklist.completedBy),winner.user._id);
    assert.ok(delivered.donation.delivery.receiptChecklist.completedAt);
    assert.equal((await action("receive",winner.token,checklist)).status,409);
  });
  await t.test("impact counts delivered listing only once",async()=>{
    const a=await request("/deliveries/impact"),b=await request("/deliveries/impact");
    assert.equal(a.stats.completedDonations,1);assert.equal(a.stats.estimatedServingsDelivered,10);
    assert.deepEqual(a.stats,b.stats);
  });
  await t.test("cancellation reaches both previously notified NGOs, retries deduplicate",async()=>{
    const d=await create();await processNotifications();
    assert.equal((await request("/donations/"+d._id+"/cancel",{method:"POST",token:donor.token,body:{reason:"Demo cancellation"}})).status,200);
    await processNotifications();const count=await Notification.countDocuments({donation:d._id});
    await processNotifications();assert.equal(await Notification.countDocuments({donation:d._id}),count);
    for(const n of [ngo,ngo2]) assert.ok(await Notification.exists({donation:d._id,user:n.user._id,type:"cancelled"}));
  });
  await t.test("expired food cannot be claimed",async()=>{
    const d=await create();
    await Donation.updateOne({_id:d._id},{$set:{expiresAt:new Date(Date.now()-1000)}});
    assert.equal((await request("/donations/"+d._id+"/claim",{method:"POST",token:ngo.token})).status,409);
  });
  await t.test("invalid orphaned claim cannot be accepted",async()=>{
    const d=await create();
    await Donation.updateOne({_id:d._id},{$set:{status:"claimed"},$unset:{claim:1}});
    assert.equal((await request("/deliveries/"+d._id+"/accept",{method:"POST",token:volunteer.token})).status,409);
  });
  await t.test("1000-character rejection reason records without blocking notifications", async()=>{
    const d=await create();
    await request("/donations/"+d._id+"/claim",{method:"POST",token:ngo.token});
    await request("/deliveries/"+d._id+"/accept",{method:"POST",token:volunteer.token});
    const rejected=await request("/deliveries/"+d._id+"/dispatch",{
      method:"POST",token:volunteer.token,body:{...checklist,accepted:false,reason:"R".repeat(1000)}
    });
    assert.equal(rejected.status,200,JSON.stringify(rejected));
    assert.equal(rejected.donation.rejectionReason.length,1000);
    await processNotifications();
    assert.ok(await Notification.exists({donation:d._id,user:donor.user._id,type:"rejected"}));
  });
  await t.test("notification ownership and logout invalidate session",async()=>{
    const privateNote=await Notification.findOne({user:donor.user._id});
    assert.equal((await request("/notifications/"+privateNote._id+"/read",{method:"PATCH",token:ngo.token})).status,404);
    assert.equal((await request("/auth/logout",{method:"POST",token:donor.token})).status,200);
    assert.equal((await request("/auth/me",{token:donor.token})).status,401);
  });
});
