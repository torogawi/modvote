// components/CountdownTimer.tsx
"use client"

import { useEffect, useState } from "react"

export default function CountdownTimer({ endDate }: { endDate: Date }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(endDate).getTime() - now;

      if (distance < 0) {
        setTimeLeft("Voting has ended! Installing shortly...");
        clearInterval(interval);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeLeft(`${days}d ${hours}h ${minutes}m remaining`);
    }, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <span className="font-semibold text-white ml-2 bg-indigo-600 px-3 py-1 rounded-md shadow-sm">
      {timeLeft || "Calculating..."}
    </span>
  )
}