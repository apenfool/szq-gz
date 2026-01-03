const QuestionData = {
  questions: [],
  questionIdCounter: 0,

  async loadFromCSV(csvText, defaultCategory = "国职游泳救生员初级") {
    const lines = csvText.trim().split("\n");

    const newQuestions = [];
    let duplicateCount = 0;
    let skipCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        skipCount++;
        continue;
      }

      const values = this.parseCSVLine(line);
      if (values.length < 10) {
        skipCount++;
        continue;
      }

      this.questionIdCounter++;

      let answer = values[9]?.trim() || "";
      const questionType = values[1]?.trim() || "判断题";

      if (questionType === "判断题") {
        if (answer === "正确" || answer === "B" || answer === "b") {
          answer = "A";
        } else if (answer === "错误" || answer === "A" || answer === "a") {
          answer = "B";
        }
      } else {
        answer = answer.toUpperCase();
      }

      const question = {
        id: Date.now() + this.questionIdCounter,
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

      if (!question.question) {
        skipCount++;
        continue;
      }

      const isDuplicate = this.questions.some(
        (q) => q.question === question.question && q.answer === question.answer
      );

      if (isDuplicate) {
        duplicateCount++;
      } else {
        newQuestions.push(question);
      }
    }

    this.questions = [...this.questions, ...newQuestions];

    return {
      total: newQuestions.length,
      new: newQuestions.length,
      duplicate: duplicateCount,
      skip: skipCount,
    };
  },

  parseCSVLine(line) {
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
  },

  getQuestions(options = {}) {
    let filtered = [...this.questions];

    if (options.types && options.types.length > 0) {
      filtered = filtered.filter((q) => options.types.includes(q.type));
    }

    if (options.categories && options.categories.length > 0) {
      filtered = filtered.filter((q) =>
        options.categories.includes(q.category)
      );
    }

    if (options.count) {
      filtered = filtered.slice(0, options.count);
    }

    return filtered;
  },

  getRandomQuestions(count, options = {}) {
    let pool = this.getQuestions(options);

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    return selected.map((q, index) => ({ ...q, displayIndex: index + 1 }));
  },

  getQuestionsByCategory() {
    const categories = {};
    this.questions.forEach((q) => {
      if (!categories[q.category]) {
        categories[q.category] = [];
      }
      categories[q.category].push(q);
    });
    return categories;
  },

  getTypeCount() {
    const counts = {
      判断题: 0,
      单选题: 0,
    };
    this.questions.forEach((q) => {
      if (counts.hasOwnProperty(q.type)) {
        counts[q.type]++;
      }
    });
    return counts;
  },

  getCategoryStats() {
    const categories = {};
    this.questions.forEach((q) => {
      if (!categories[q.category]) {
        categories[q.category] = {
          total: 0,
          判断题: 0,
          单选题: 0,
          subCategories: {},
        };
      }
      categories[q.category].total++;
      if (q.type === "判断题" || q.type === "单选题") {
        categories[q.category][q.type]++;
      }
      const subCat = q.subCategory || "基础常识";
      if (!categories[q.category].subCategories[subCat]) {
        categories[q.category].subCategories[subCat] = 0;
      }
      categories[q.category].subCategories[subCat]++;
    });
    return categories;
  },

  getSubCategories() {
    const subCats = new Set();
    const defaultSubCats = ["基础常识", "技能知识", "急救知识", "管理规范"];
    defaultSubCats.forEach((cat) => subCats.add(cat));
    this.questions.forEach((q) => {
      if (q.subCategory) {
        subCats.add(q.subCategory);
      }
    });
    return Array.from(subCats).sort((a, b) => {
      const order = ["基础常识", "技能知识", "急救知识", "管理规范"];
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  },

  addQuestion(question) {
    const isDuplicate = this.questions.some(
      (q) => q.question === question.question && q.answer === question.answer
    );

    if (isDuplicate) {
      return { success: false, message: "题目已存在" };
    }

    const newQuestion = {
      ...question,
      id: Date.now(),
      wrongCount: 0,
      correctCount: 0,
      lastPracticed: null,
    };

    this.questions.push(newQuestion);
    return { success: true, question: newQuestion };
  },

  updateQuestion(id, updates) {
    const index = this.questions.findIndex((q) => q.id === id);
    if (index === -1) {
      return { success: false, message: "题目不存在" };
    }

    this.questions[index] = { ...this.questions[index], ...updates };
    return { success: true, question: this.questions[index] };
  },

  deleteQuestion(id) {
    const index = this.questions.findIndex((q) => q.id === id);
    if (index === -1) {
      return { success: false, message: "题目不存在" };
    }

    this.questions.splice(index, 1);
    return { success: true };
  },

  isLoaded() {
    return this.questions.length > 0;
  },

  getTotalCount() {
    return this.questions.length;
  },

  exportToCSV() {
    const headers = [
      "序号",
      "题型",
      "题型分类",
      "题干",
      "选项A",
      "选项B",
      "选项C",
      "选项D",
      "答案",
      "解释",
    ];
    const rows = this.questions.map((q) => [
      q.number,
      q.type,
      q.category,
      q.question,
      q.optionA,
      q.optionB,
      q.optionC,
      q.optionD,
      q.answer,
      q.analysis,
    ]);

    return [
      headers.join(","),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
  },

  getQuestionById(id) {
    return this.questions.find((q) => q.id === id);
  },

  getWrongQuestions() {
    return this.questions.filter((q) => q.wrongCount > 0);
  },

  incrementWrongCount(id) {
    const question = this.getQuestionById(id);
    if (question) {
      question.wrongCount++;
      question.lastPracticed = new Date().toISOString();
    }
  },

  incrementCorrectCount(id) {
    const question = this.getQuestionById(id);
    if (question) {
      question.correctCount++;
      question.lastPracticed = new Date().toISOString();
    }
  },

  resetProgress(id) {
    const question = this.getQuestionById(id);
    if (question) {
      question.wrongCount = 0;
      question.correctCount = 0;
    }
  },
};

window.QuestionData = QuestionData;
