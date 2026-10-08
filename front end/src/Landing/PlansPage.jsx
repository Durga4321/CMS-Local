import React from "react";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { Link } from "react-router-dom";
import SubscriptionPlans from "./SubscriptionPlans";
import "./LandingPage.css";
export default function PlansPage(){
 return <main className="subscription-page"><header className="subscription-page-nav"><Link to="/" className="subscription-page-brand"><HeartPulse size={24}/><span><b>CMS</b><small>Clinical Intelligence System</small></span></Link><Link to="/" className="subscription-back"><ArrowLeft size={16}/> Back to home</Link></header><SubscriptionPlans/></main>
}