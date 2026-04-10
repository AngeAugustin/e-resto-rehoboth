import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-middleware";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET() {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const users = await User.find().select("-password").sort({ createdAt: -1 });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["directeur"]);
  if (error) return error;

  await connectDB();
  const body = await req.json();
  const { firstName, lastName, email, password, phone, address, role } = body;

  if (!firstName || !lastName || !email || !password || !role) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: "Un utilisateur avec cet email existe déjà" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    password: hashedPassword,
    phone: phone || "",
    address: address || "",
    role,
  });

  const { password: _, ...userWithoutPassword } = user.toObject();
  return NextResponse.json(userWithoutPassword, { status: 201 });
}
