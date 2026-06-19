import React from "react";
import { Star, Trophy, Sunrise, Moon, Flame, Zap, Wind, CloudRain, Snowflake, Users, Heart, Crown, Target, Timer, Compass, Map, Coffee, Activity, Medal } from "lucide-react";

export const TROPHIES = [
  // ДИСТАНЦИЯ (Distance)
  { id: 1, name: "Первый Шаг", icon: <Star size={24} className="text-amber-600" />, desc: "Первая пробежка", condition: (km: number) => km > 0 },
  { id: 2, name: "Пятёрка", icon: <Star size={24} className="text-primary" />, desc: "Пробежать 5 км", condition: (km: number) => km >= 5 },
  { id: 3, name: "Десятка", icon: <Star size={24} className="text-cyan-400" />, desc: "Пробежать 10 км", condition: (km: number) => km >= 10 },
  { id: 4, name: "Полумарафон", icon: <Medal size={24} className="text-purple-500" />, desc: "Пробежать 21.1 км", condition: (km: number) => km >= 21.1 },
  { id: 5, name: "Марафонец", icon: <Trophy size={24} className="text-red-500" />, desc: "Пробежать 42.2 км", condition: (km: number) => km >= 42.2 },
  { id: 6, name: "Сотня", icon: <Crown size={24} className="text-yellow-400" />, desc: "Суммарно 100 км", condition: (km: number) => km >= 100 },
  { id: 7, name: "Экватор", icon: <Map size={24} className="text-emerald-500" />, desc: "Суммарно 500 км", condition: (km: number) => km >= 500 },
  { id: 8, name: "Космос", icon: <Rocket size={24} className="text-indigo-500" />, desc: "Суммарно 1000 км", condition: (km: number) => km >= 1000 },
  
  // ВРЕМЯ СУТОК (Time of Day)
  { id: 9, name: "Ранняя Пташка", icon: <Sunrise size={24} className="text-orange-400" />, desc: "Пробежка до 6:00 утра", condition: () => false }, // Mock
  { id: 10, name: "Сова", icon: <Moon size={24} className="text-indigo-300" />, desc: "Пробежка после 23:00", condition: () => false },
  { id: 11, name: "Вампир", icon: <Moon size={24} className="text-red-700" />, desc: "Пробежка в 3:00 ночи", condition: () => false },
  { id: 12, name: "Обеденный Перерыв", icon: <Coffee size={24} className="text-amber-800" />, desc: "Тренировка с 12 до 14", condition: () => false },
  
  // ПОГОДА (Weather)
  { id: 13, name: "Ветродуй", icon: <Wind size={24} className="text-slate-300" />, desc: "Пробежка при ветре >10 м/с", condition: () => false },
  { id: 14, name: "Аквамен", icon: <CloudRain size={24} className="text-blue-400" />, desc: "Бег под проливным дождем", condition: () => false },
  { id: 15, name: "Йети", icon: <Snowflake size={24} className="text-cyan-200" />, desc: "Пробежка при -15°C", condition: () => false },
  { id: 16, name: "Пекло", icon: <Flame size={24} className="text-red-600" />, desc: "Пробежка при +30°C", condition: () => false },
  
  // СТРИКИ (Streaks)
  { id: 17, name: "Выходные", icon: <Timer size={24} className="text-pink-400" />, desc: "Бег в СБ и ВС подряд", condition: () => false },
  { id: 18, name: "Неделя", icon: <Activity size={24} className="text-primary" />, desc: "7 дней бега подряд", condition: () => false },
  { id: 19, name: "Месяц Кардио", icon: <Heart size={24} className="text-red-400" />, desc: "30 дней бега подряд", condition: () => false },
  { id: 20, name: "Маньяк", icon: <Zap size={24} className="text-yellow-500" />, desc: "100 дней бега подряд", condition: () => false },
  
  // ТЕМП И СКОРОСТЬ (Pace & Speed)
  { id: 21, name: "Ракета", icon: <Zap size={24} className="text-yellow-300" />, desc: "Темп быстрее 4:00/км", condition: () => false },
  { id: 22, name: "Ветерок", icon: <Wind size={24} className="text-blue-300" />, desc: "Темп быстрее 5:00/км", condition: () => false },
  { id: 23, name: "Тише Едешь", icon: <Target size={24} className="text-green-500" />, desc: "Восстановительный бег > 7:00/км", condition: () => false },
  
  // СОЦИАЛЬНЫЕ (Social & Club)
  { id: 24, name: "Душа Компании", icon: <Users size={24} className="text-purple-400" />, desc: "Пробежка с 5 друзьями", condition: () => false },
  { id: 25, name: "Лидер Клуба", icon: <Crown size={24} className="text-yellow-500" />, desc: "Топ-1 в рейтинге клуба", condition: () => false },
  { id: 26, name: "Писатель", icon: <Compass size={24} className="text-slate-400" />, desc: "Написать 10 постов в ленте", condition: () => false },
  { id: 27, name: "Лайкер", icon: <Heart size={24} className="text-pink-500" />, desc: "Поставить 50 лайков", condition: () => false },
  
  // ЛОКАЦИИ (Locations - mock)
  { id: 28, name: "Исследователь", icon: <Map size={24} className="text-green-600" />, desc: "10 разных маршрутов", condition: () => false },
  { id: 29, name: "Царь Горы", icon: <Medal size={24} className="text-orange-500" />, desc: "Набор высоты 500м", condition: () => false },
  { id: 30, name: "Парковый Бегун", icon: <Star size={24} className="text-emerald-400" />, desc: "10 пробежек в парках", condition: () => false },

  // СЕЗОННЫЕ (Seasonal)
  { id: 31, name: "Новогодний Забег", icon: <Snowflake size={24} className="text-blue-100" />, desc: "Пробежка 1 января", condition: () => false },
  { id: 32, name: "Летний Зной", icon: <Sunrise size={24} className="text-yellow-600" />, desc: "10 пробежек за июль", condition: () => false },
  { id: 33, name: "Осенний Марафон", icon: <Wind size={24} className="text-orange-700" />, desc: "Бег в сентябре", condition: () => false },
  { id: 34, name: "Весеннее Обострение", icon: <Flame size={24} className="text-pink-500" />, desc: "5 пробежек в неделю весной", condition: () => false },
];

// Fallback for missing icon in import
function Rocket(props: any) {
    return <Zap {...props} />;
}
