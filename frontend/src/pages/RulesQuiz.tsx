import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import rawQuiz from "../rules-quiz/questions.json";

const PASS_RATIO = 0.7;

interface QuizAnswerOption {
  answer: string;
  is_correct: boolean;
}

interface QuizQuestionItem {
  question: string;
  answer: QuizAnswerOption[];
}

interface PreparedQuestion {
  question: string;
  shuffledOptions: QuizAnswerOption[];
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function prepareQuestions(items: QuizQuestionItem[]): PreparedQuestion[] {
  return items.map((q) => ({
    question: q.question,
    shuffledOptions: shuffle(q.answer),
  }));
}

type Phase = "intro" | "quiz" | "results";

const RulesQuiz: React.FC = () => {
  const sourceQuestions = rawQuiz.questions as QuizQuestionItem[];

  const [phase, setPhase] = useState<Phase>("intro");
  const [prepared, setPrepared] = useState<PreparedQuestion[]>([]);
  const [step, setStep] = useState(0);
  const [correctFlags, setCorrectFlags] = useState<boolean[]>([]);

  const total = sourceQuestions.length;
  const passNeed = useMemo(
    () => Math.max(1, Math.ceil(total * PASS_RATIO)),
    [total],
  );

  const startQuiz = useCallback(() => {
    setPrepared(prepareQuestions(sourceQuestions));
    setStep(0);
    setCorrectFlags([]);
    setPhase("quiz");
  }, [sourceQuestions]);

  const current = phase === "quiz" ? prepared[step] : undefined;

  const onPickOption = (option: QuizAnswerOption) => {
    if (phase !== "quiz" || !current) return;

    const nextFlags = [...correctFlags, option.is_correct];
    setCorrectFlags(nextFlags);

    if (step + 1 >= prepared.length) {
      setPhase("results");
    } else {
      setStep((s) => s + 1);
    }
  };

  const correctCount = correctFlags.filter(Boolean).length;
  const passed =
    correctFlags.length > 0 && correctCount >= passNeed;

  const resetToIntro = () => {
    setPhase("intro");
    setPrepared([]);
    setStep(0);
    setCorrectFlags([]);
  };

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 text-center">
        Квиз по правилам
      </h1>
      <p className="text-sm text-gray-500 text-center mb-6 sm:mb-8">
        <Link to="/" className="text-primary-600 hover:text-primary-700">
          На главную
        </Link>
      </p>

      {phase === "intro" && (
        <div className="card p-6 sm:p-8">
          <p className="text-gray-700 leading-relaxed mb-4">
            Этот квиз помогает проверить и закрепить знания по столицам европейских стран.<br/>

            На каждом шаге показывается один вопрос с несколькими вариантами ответа.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            В конце отображается число верных ответов и статус прохождения:
            зачёт ставится, если доля правильных ответов не ниже{" "}
            {Math.round(PASS_RATIO * 100)}% (для текущего набора нужно минимум{" "}
            {passNeed} из {total} верных).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
            <button type="button" className="btn-primary" onClick={startQuiz}>
              Начать
            </button>
          </div>
        </div>
      )}

      {phase === "quiz" && current && (
        <div className="card p-6 sm:p-8">
          <p className="text-sm text-gray-500 mb-4">
            Вопрос {step + 1} из {prepared.length}
          </p>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-6">
            {current.question}
          </h2>
          <ul className="space-y-3">
            {current.shuffledOptions.map((opt) => (
              <li key={`${step}-${opt.answer}`}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-primary-400 hover:bg-primary-50/50 transition-colors text-gray-900"
                  onClick={() => onPickOption(opt)}
                >
                  {opt.answer}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === "results" && (
        <div className="card p-6 sm:p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Результат
          </h2>
          <p className="text-gray-700 mb-2">
            Верных ответов:{" "}
            <span className="font-semibold text-gray-900">
              {correctCount} из {correctFlags.length}
            </span>
          </p>
          <p className="text-gray-700 mb-6">
            Для зачёта требовалось:{" "}
            <span className="font-semibold">{passNeed}</span> из {total}.
          </p>
          <div
            className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold mb-8 ${
              passed
                ? "bg-success-100 text-success-800"
                : "bg-warning-100 text-warning-800"
            }`}
          >
            {passed ? "Статус: пройден" : "Статус: не пройден"}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" className="btn-primary" onClick={startQuiz}>
              Пройти снова
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={resetToIntro}
            >
              К описанию
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RulesQuiz;
