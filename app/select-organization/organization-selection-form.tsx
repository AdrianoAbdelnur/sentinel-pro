"use client";
import AuthForm from "@/app/auth-form";
export default function OrganizationSelectionForm() { return <AuthForm endpoint="/api/auth/select-organization" fields="organization" submitLabel="Continue" />; }
