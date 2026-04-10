import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import RestaurantTable from "@/models/RestaurantTable";
import Waitress from "@/models/Waitress";
import bcrypt from "bcryptjs";

export async function POST() {
  await connectDB();

  // Create default users if not exist
  const defaultUsers = [
    {
      firstName: "Admin",
      lastName: "Directeur",
      email: "directeur@restaurant.com",
      password: "Admin123!",
      phone: "0700000001",
      address: "Siège",
      role: "directeur",
    },
    {
      firstName: "Moussa",
      lastName: "Konaté",
      email: "gerant@restaurant.com",
      password: "Gerant123!",
      phone: "0700000002",
      address: "Restaurant",
      role: "gerant",
    },
  ];

  for (const u of defaultUsers) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      const hashedPassword = await bcrypt.hash(u.password, 12);
      await User.create({ ...u, password: hashedPassword });
    }
  }

  // Create tables 1-12 if not exist
  const tableCount = await RestaurantTable.countDocuments();
  if (tableCount === 0) {
    const tables = Array.from({ length: 12 }, (_, i) => ({
      number: i + 1,
      name: `Table ${i + 1}`,
      capacity: 4,
    }));
    await RestaurantTable.insertMany(tables);
  }

  // Create sample waitresses if not exist
  const waitressCount = await Waitress.countDocuments();
  if (waitressCount === 0) {
    await Waitress.insertMany([
      { firstName: "Aminata", lastName: "Diallo", phone: "0701234567" },
      { firstName: "Fatoumata", lastName: "Traoré", phone: "0702345678" },
      { firstName: "Kadiatou", lastName: "Bah", phone: "0703456789" },
    ]);
  }

  return NextResponse.json({
    message: "Base de données initialisée avec succès",
    credentials: [
      { role: "directeur", email: "directeur@restaurant.com", password: "Admin123!" },
      { role: "gerant", email: "gerant@restaurant.com", password: "Gerant123!" },
    ],
  });
}
