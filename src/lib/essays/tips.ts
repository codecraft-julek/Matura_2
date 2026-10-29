// "Czy wiesz, że…" facts shown while the AI is thinking.
// Every fact comes from the official CKE scoring rules (2025 "zasady oceniania") or the exam sheets.
// Keep them accurate: students will trust them.

import type { RubricId } from "@shared/essay";

export const LOADER_TIPS: Record<RubricId, string[]> = {
  polish_basic: [
    "Za kompetencje literackie i kulturowe możesz dostać aż 16 z 35 punktów, prawie połowę całej oceny.",
    "Poniżej 300 wyrazów CKE ocenia tylko warunki formalne i kompetencje literackie. Reszta to 0 pkt.",
    "Błąd kardynalny, czyli rażące przekłamanie lektury obowiązkowej, to 0 pkt za całe wypracowanie.",
    "Najwyżej oceniane są dwa konteksty wykorzystane funkcjonalnie, czyli takie, które naprawdę wspierają argument.",
    "Powtórzenie słów z tematu nie jest błędem językowym.",
    "Za interpunkcję dostajesz 2 pkt nawet wtedy, gdy masz do 8 błędów.",
    "Wypracowanie napisane w punktach albo w formie planu dostaje 0 pkt.",
  ],
  polish_extended: [
    "Na rozszerzeniu za 16 pkt z kompetencji literackich trzeba wykorzystać w pełni funkcjonalnie trzy utwory: lekturę obowiązkową i dwa inne.",
    "Utwór jest w pełni funkcjonalny, gdy piszesz i o jego problematyce, i o sposobie przedstawienia, np. o konwencji czy narracji.",
    "Każdy błąd rzeczowy to minus 1 pkt w kompetencjach literackich i kulturowych.",
    "Poniżej 400 wyrazów CKE ocenia tylko warunki formalne i kompetencje literackie. W arkuszach z 2023 i 2024 roku minimum wynosiło 500.",
    "Pełne 3 pkt za strukturę dostaje tylko układ problemowy. Omawianie utworów po kolei to najwyżej 2 pkt.",
    "Na rozszerzeniu 2 pkt za ortografię dostaje tylko praca bez żadnego błędu ortograficznego.",
    "Za interpunkcję masz 2 pkt przy najwyżej 5 błędach. Tytuł bez cudzysłowu też jest błędem interpunkcyjnym.",
    "Streszczenie utworu nie jest argumentem.",
  ],
  english_basic: [
    "Za treść możesz dostać 5 z 12 punktów, więc każdy podpunkt polecenia się liczy.",
    "Spójność to 2 pkt: łączniki typu however, because czy that's why naprawdę pomagają.",
    "Za zakres środków językowych są 3 pkt. Różnorodne słownictwo się opłaca.",
    "Wklejając polecenie z arkusza, pozwalasz AI sprawdzić też treść.",
  ],
  english_extended: [
    "Poniżej 160 wyrazów CKE ocenia tylko zgodność z poleceniem.",
    "Wypowiedź na rozszerzeniu powinna mieć od 200 do 250 wyrazów.",
    "Za zakres środków językowych są 3 pkt. Bogate słownictwo i struktury się opłacają.",
    "Liczy się też forma: rozprawka, list formalny i artykuł mają swoje wymogi.",
  ],
};
