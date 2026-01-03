const fs = require("fs");
const path = require("path");

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function loadFromCSV(csvText, defaultCategory = "国职游泳救生员初级") {
  const lines = csvText.trim().split("\n");
  const questions = [];
  let questionIdCounter = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < 10) continue;

    questionIdCounter++;

    let answer = values[9]?.trim() || "";
    const questionType = values[1]?.trim() || "判断题";

    if (questionType === "判断题") {
      if (answer === "正确" || answer === "A") {
        answer = "A";
      } else if (answer === "错误" || answer === "B") {
        answer = "B";
      }
    }

    const question = {
      id: Date.now() + questionIdCounter,
      number: parseInt(values[0]) || i,
      type: questionType,
      category: values[2]?.trim() || defaultCategory,
      subCategory: values[3]?.trim() || "基础常识",
      question: values[4]?.trim() || "",
      optionA: values[5]?.trim() || "",
      optionB: values[6]?.trim() || "",
      optionC: values[7]?.trim() || "",
      optionD: values[8]?.trim() || "",
      answer: answer,
      analysis: values[10]?.trim() || "",
      wrongCount: 0,
      correctCount: 0,
      lastPracticed: null,
    };

    if (!question.question) continue;
    questions.push(question);
  }

  return questions;
}

async function main() {
  try {
    const csvPath = path.join(__dirname, "题库导入模板.csv");
    const csvText = fs.readFileSync(csvPath, "utf8");

    const questions = await loadFromCSV(csvText, "国职游泳救生员初级");

    console.log(`总共解析出 ${questions.length} 道题目`);

    const judgmentQuestions = questions.filter((q) => q.type === "判断题");
    const choiceQuestions = questions.filter((q) => q.type === "单选题");

    console.log(`判断题: ${judgmentQuestions.length} 道`);
    console.log(`单选题: ${choiceQuestions.length} 道`);

    const judgmentWithAnswerA = judgmentQuestions.filter(
      (q) => q.answer === "A"
    );
    const judgmentWithAnswerB = judgmentQuestions.filter(
      (q) => q.answer === "B"
    );

    console.log(`判断题中答案为A(正确)的: ${judgmentWithAnswerA.length} 道`);
    console.log(`判断题中答案为B(错误)的: ${judgmentWithAnswerB.length} 道`);

    const outputPath = path.join(__dirname, "js", "questions.json");
    fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2), "utf8");
    console.log(`题目已导出到 ${outputPath}`);

    console.log("\n前5道判断题示例:");
    judgmentQuestions.slice(0, 5).forEach((q, idx) => {
      console.log(
        `${idx + 1}. [${q.answer}] ${q.question.substring(0, 50)}...`
      );
    });
  } catch (error) {
    console.error("导入失败:", error);
  }
}

main();
