import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  PERSONAL_DATA_OPERATOR_NAME,
  PERSONAL_DATA_POLICY_PATH,
} from "../constants/personalData";
import {
  acceptCookieConsent,
  COOKIE_CONSENT_RESET_EVENT,
  hasCookieConsentDecision,
  rejectCookieConsent,
} from "../utils/cookieConsent";

const CookieConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const syncVisibility = () => {
      setVisible(!hasCookieConsentDecision());
    };
    syncVisibility();
    window.addEventListener(COOKIE_CONSENT_RESET_EVENT, syncVisibility);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_RESET_EVENT, syncVisibility);
    };
  }, []);

  const handleAccept = () => {
    acceptCookieConsent();
    setVisible(false);
  };

  const handleReject = () => {
    rejectCookieConsent();
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6 pointer-events-none"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
    >
      <div className="mx-auto max-w-4xl pointer-events-auto">
        <div className="rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <h2
                id="cookie-consent-title"
                className="text-sm font-semibold text-gray-900 sm:text-base"
              >
                Согласие на обработку персональных данных
              </h2>
              <p
                id="cookie-consent-description"
                className="mt-2 text-xs text-gray-600 sm:text-sm leading-relaxed"
              >
                {PERSONAL_DATA_OPERATOR_NAME} (оператор персональных данных)
                использует файлы cookie и аналогичные технологии для сохранения
                настроек интерфейса и учёта вашего выбора. Обработка осуществляется на основании вашего
                согласия в соответствии с Федеральным законом № 152-ФЗ «О
                персональных данных». Вы вправе отказаться от необязательных
                cookie — в этом случае сайт останется доступен, но настройки не
                будут сохраняться между визитами. Подробнее — в{" "}
                <Link
                  to={PERSONAL_DATA_POLICY_PATH}
                  className="text-primary-600 hover:underline font-medium"
                >
                  Политике обработки персональных данных
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={handleReject}
                className="btn-secondary w-full sm:w-auto"
              >
                Отклонить
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="btn-primary w-full sm:w-auto"
              >
                Принять
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CookieConsentBanner;
