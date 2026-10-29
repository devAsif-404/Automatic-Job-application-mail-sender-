import dotenv from "dotenv";
dotenv.config();

async function testFastFetch() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  const modelName = process.env.GEMINI_MODEL || "gemini-flash-latest";
  console.log(`Calling ${modelName} via native REST API...`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const payload = {
    systemInstruction: {
      parts: [{ text: "You are an executive career strategist. Always return strictly valid JSON matching schema: {\"subject\": string, \"greeting\": string, \"emailBody\": string, \"coverLetter\": string, \"validationNotes\": string}" }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: "Generate personalized application for candidate Asif Shaikh (skills: Next.js, Node.js, TypeScript, PostgreSQL) applying to Google for Full Stack Software Engineer. Recruiter: Sundar Pichai." }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  const start = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  const elapsed = Date.now() - start;
  console.log(`Received response in ${elapsed}ms!`);

  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    const raw = data.candidates[0].content.parts[0].text;
    console.log(">>> [SUCCESS] GEMINI RETURNED JSON: <<<");
    console.log(raw.slice(0, 400));
  } else {
    console.log("API Response Error:", JSON.stringify(data));
  }
}

testFastFetch();
