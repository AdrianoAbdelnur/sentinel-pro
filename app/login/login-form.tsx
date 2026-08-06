"use client";
import AuthForm from "@/app/auth-form";
export default function LoginForm() { return <AuthForm endpoint="/api/auth/login" fields="login" submitLabel="Sign in" />; }
