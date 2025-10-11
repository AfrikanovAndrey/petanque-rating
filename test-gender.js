// Простой тест для проверки алгоритма определения пола
function detectGender(fullName) {
  const name = fullName.trim().toLowerCase();
  
  // Разбиваем на части (имя фамилия отчество)
  const nameParts = name.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[1] : "";
  
  console.log(`🔍 Определяю пол для: "${fullName}" -> "${firstName}"`);

  // Типичные женские окончания
  const FEMALE_ENDINGS = [
    "а", "я", "ия", "ья", "на", "ла", "ра", "са", "та", "ка", "га", "ва", "да", "за", "ма", "па", "ха", "ча", "ша", "ща",
    "ина", "ана", "ена", "она", "уна", "ына"
  ];

  // Типичные мужские окончания
  const MALE_ENDINGS = [
    "ий", "ей", "ай", "ой", "ый", "ин", "он", "ен", "ан", "ун", "ын",
    "дир", "мир", "тор", "сор", "нор", "лор",
    "др", "нс", "ил", "ел", "им", "ём", "ак", "ек", "ич", "юш", "ат", "ав"
  ];

  // Однозначно мужские имена
  const DEFINITELY_MALE = [
    "игорь", "олег", "глеб", "лев", "давид", "даниил",
    "александр", "андрей", "алексей", "анатолий", "антон", "артём", "артем", "борис", "вадим", "валерий", "василий", "виктор", "владимир", "владислав", "вячеслав", "геннадий", "георгий", "денис", "дмитрий", "евгений", "егор", "иван", "илья", "кирилл", "константин", "максим", "михаил", "николай", "павел", "пётр", "петр", "роман", "сергей", "станислав", "юрий", "ярослав"
  ];

  // Проверяем однозначные имена
  if (DEFINITELY_MALE.includes(firstName)) {
    return { gender: "male", confidence: "high", reason: "однозначно мужское имя" };
  }

  // Определяем по окончаниям имени
  for (const ending of FEMALE_ENDINGS) {
    if (firstName.endsWith(ending)) {
      const confidence = ending.length > 2 ? "high" : "medium";
      return { gender: "female", confidence, reason: `женское окончание "-${ending}"` };
    }
  }

  for (const ending of MALE_ENDINGS) {
    if (firstName.endsWith(ending)) {
      const confidence = ending.length > 2 ? "high" : "medium";
      return { gender: "male", confidence, reason: `мужское окончание "-${ending}"` };
    }
  }

  // Проверяем фамилию
  if (lastName) {
    if (lastName.endsWith("ова") || lastName.endsWith("ева") || lastName.endsWith("ина") || lastName.endsWith("ская")) {
      return { gender: "female", confidence: "medium", reason: "женское окончание фамилии" };
    }
    
    if (lastName.endsWith("ов") || lastName.endsWith("ев") || lastName.endsWith("ин") || lastName.endsWith("ский")) {
      return { gender: "male", confidence: "medium", reason: "мужское окончание фамилии" };
    }
  }

  // Правило для русских имен: большинство мужских имен заканчиваются на согласные
  const lastChar = firstName.charAt(firstName.length - 1);
  const consonants = 'бвгджзйклмнпрстфхцчшщ';
  const vowels = 'аеёиоуыэюя';
  
  if (consonants.includes(lastChar)) {
    if (!firstName.endsWith('ь')) {
      return { gender: "male", confidence: "medium", reason: "имя заканчивается на согласную (типично для мужских имен)" };
    }
  }
  
  return { gender: null, confidence: "low", reason: "не удалось определить по правилам русского языка" };
}

// Тестируем на примерах из вашего списка
const testNames = [
  "Большаков Василий",
  "Крошилов Александр",
  "Африканов Андрей", 
  "Лямунов Никита",
  "Волков Денис",
  "Вахрушев Владимир",
  "Гаджиев Сеявуш",
  "Денисов Евгений",
  "Федотов Николай",
  "Северов Михаил",
  "Большакова Мария",
  "Зубова Наталья",
  "Кирменская Елена"
];

console.log("🧪 Тестирование улучшенного алгоритма:\n");

testNames.forEach(name => {
  const result = detectGender(name);
  console.log(`👤 ${name}: ${result.gender || 'неизвестно'} (${result.confidence}) - ${result.reason}\n`);
});
