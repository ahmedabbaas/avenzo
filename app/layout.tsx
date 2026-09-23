import type { Metadata } from "next";import "./globals.css";
export const metadata:Metadata={title:"AVENZO — Connect. Share. Belong.",description:"AVENZO is a social platform for people, moments and conversations."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}