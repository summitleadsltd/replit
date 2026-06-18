import { describe, it, expect } from "vitest";

// CTPS validation function (mock rule matching worker.js)
const checkCtpsClean = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\s+/g, "");
  const lastDigit = cleanPhone.slice(-1);
  return lastDigit !== "7" && lastDigit !== "9";
};

// GDPR LIA and Priority classification rules
interface IcpInputs {
  roofAreaSqm: number;
  orientation: string;
  shading: string;
  turnover: number;
  employeeCount: number;
  esgKeywords: string[];
  hasTriggerEvents: boolean;
  hasContacts: boolean;
}

const calculateIcpScoreAndPriority = (inputs: IcpInputs) => {
  let score = 0;

  // Roof suitability (0-3 points)
  let roofScore = 0;
  if (inputs.roofAreaSqm >= 1000) roofScore += 1.5;
  else if (inputs.roofAreaSqm >= 500) roofScore += 1.0;
  else if (inputs.roofAreaSqm >= 100) roofScore += 0.5;

  if (inputs.orientation === "South") roofScore += 0.75;
  else if (["East", "West"].includes(inputs.orientation)) roofScore += 0.5;

  if (inputs.shading === "None") roofScore += 0.75;
  else if (inputs.shading === "Partial") roofScore += 0.35;

  score += Math.min(3, roofScore);

  // Company size (0-2 points)
  let sizeScore = 0;
  if (inputs.turnover >= 10000000 || inputs.employeeCount >= 200) {
    sizeScore = 2;
  } else if (inputs.turnover >= 2000000 || inputs.employeeCount >= 50) {
    sizeScore = 1;
  }
  score += sizeScore;

  // ESG commitment (0-2 points)
  let esgScore = 0;
  if (inputs.esgKeywords.length >= 3) esgScore = 2;
  else if (inputs.esgKeywords.length >= 1) esgScore = 1;
  score += esgScore;

  // Trigger events (0-2 points)
  score += inputs.hasTriggerEvents ? 2 : 0;

  // Contact accessibility (0-1 points)
  score += inputs.hasContacts ? 1 : 0;

  const finalScore = Math.min(10, Math.round(score));

  let priority: "COLD" | "WARM" | "HOT" = "COLD";
  if (finalScore >= 8) priority = "HOT";
  else if (finalScore >= 5) priority = "WARM";

  const gdprLiaPassed = finalScore >= 5;

  return {
    score: finalScore,
    priority,
    gdprLiaPassed
  };
};

describe("SolarScout Compliance: CTPS Filtering", () => {
  it("marks a clean UK number as clean", () => {
    expect(checkCtpsClean("+44 20 7946 0012")).toBe(true);
    expect(checkCtpsClean("+44 7700 900088")).toBe(true);
  });

  it("marks a blacklisted number (ending in 7) as excluded", () => {
    expect(checkCtpsClean("+44 7700 900077")).toBe(false);
  });

  it("marks a blacklisted number (ending in 9) as excluded", () => {
    expect(checkCtpsClean("+44 20 7946 0599")).toBe(false);
  });
});

describe("SolarScout Scoring: ICP and GDPR LIA mapping", () => {
  it("classifies high suitability targets as HOT and GDPR LIA Compliant", () => {
    const res = calculateIcpScoreAndPriority({
      roofAreaSqm: 1200,      // 1.5 pts
      orientation: "South",   // 0.75 pts
      shading: "None",        // 0.75 pt -> max 3.0 pts
      turnover: 12000000,     // 2 pts (size)
      employeeCount: 240,
      esgKeywords: ["Sustainability", "Solar", "Net Zero"], // 2 pts (esg)
      hasTriggerEvents: true, // 2 pts (trigger)
      hasContacts: true       // 1 pt (contacts)
    }); // Total = 3 + 2 + 2 + 2 + 1 = 10 pts
    
    expect(res.score).toBe(10);
    expect(res.priority).toBe("HOT");
    expect(res.gdprLiaPassed).toBe(true);
  });

  it("classifies mid suitability targets as WARM and GDPR LIA Compliant", () => {
    const res = calculateIcpScoreAndPriority({
      roofAreaSqm: 600,       // 1.0 pt
      orientation: "East",    // 0.5 pt
      shading: "Partial",     // 0.35 pt -> 1.85 pts
      turnover: 4500000,      // 1 pt (size)
      employeeCount: 85,
      esgKeywords: ["Sustainability"], // 1 pt (esg)
      hasTriggerEvents: false, // 0 pts
      hasContacts: true       // 1 pt (contacts)
    }); // Total = 1.85 + 1 + 1 + 1 = 4.85 -> rounds to 5 pts
    
    expect(res.score).toBe(5);
    expect(res.priority).toBe("WARM");
    expect(res.gdprLiaPassed).toBe(true);
  });

  it("classifies low suitability targets as COLD and GDPR Exempt (subject to purge)", () => {
    const res = calculateIcpScoreAndPriority({
      roofAreaSqm: 180,       // 0.5 pt
      orientation: "North",   // 0 pts
      shading: "Partial",     // 0.35 pt -> 0.85 pts
      turnover: 500000,       // 0 pts (size)
      employeeCount: 12,
      esgKeywords: [],        // 0 pts
      hasTriggerEvents: false, // 0 pts
      hasContacts: false      // 0 pts
    }); // Total = 0.85 -> rounds to 1 pt
    
    expect(res.score).toBe(1);
    expect(res.priority).toBe("COLD");
    expect(res.gdprLiaPassed).toBe(false);
  });
});
