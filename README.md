# 🍱 FoodBridge

### Smart Surplus Food Redistribution Platform

FoodBridge is a full-stack MERN application designed to reduce food waste by connecting food donors such as restaurants, college messes, cafeterias, and event organizers with NGOs and communities in need.

The platform helps donors list surplus food and enables verified organizations to discover, request, and coordinate food pickups efficiently.

---

## 🎯 Problem

Large amounts of edible food are wasted every day by restaurants, cafeterias, college messes, and events, while many people and organizations struggle to access sufficient food.

FoodBridge bridges this gap by providing a centralized platform for surplus food redistribution.

---

## 💡 Solution

FoodBridge provides a digital workflow for:

- 🍱 Listing surplus food
- 📍 Location-based food discovery
- 🏢 NGO and organization management
- 🚚 Pickup and delivery coordination
- ⏱️ Food expiry tracking
- 🔔 Notifications and live updates
- 📊 Donation and impact tracking
- 🛡️ Food safety information

---

## ✨ Features

### 👤 Authentication & Authorization
- User registration and login
- JWT-based authentication
- Protected routes
- Role-based access

### 🍽️ Food Donation
- Create food donations
- Add estimated servings
- Food type and quantity
- Preparation time
- Expiry information
- Allergens
- Storage conditions

### 📍 Location & Matching
- Location-based donation discovery
- Donor and NGO matching
- Distance-based coordination

### 🚚 Delivery Management
- Pickup requests
- Delivery workflow
- Delivery progress tracking
- Volunteer coordination

### 🔔 Notifications
- Donation updates
- Request notifications
- Delivery status updates
- Real-time updates

### 📊 Dashboards
- Donor Dashboard
- NGO Dashboard
- Volunteer Dashboard
- Admin Dashboard

---

## 🛠️ Tech Stack

### Frontend
- React.js
- Tailwind CSS
- Vite
- Axios
- React Router

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- REST APIs
- Socket.IO

### Development Tools
- Git & GitHub
- Postman
- VS Code

---

## 📂 Project Structure

```text
Foodbridge/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── hooks/
│   │   └── api/
│   ├── package.json
│   └── .gitignore
│
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── sockets/
│   │   └── utils/
│   ├── package.json
│   └── .gitignore
│
├── README.md
└── .gitignore
