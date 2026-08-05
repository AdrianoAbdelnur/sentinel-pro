"use client";
import AuthForm from "@/app/auth-form";
export default function ChangePasswordForm() { return <AuthForm endpoint="/api/auth/change-password" fields="password" submitLabel="Change password" />; }
