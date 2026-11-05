// One sentence describing a creator's deal, for their panel ("Dostajesz…") and /admin ("Dostaje…").

export function dealText(p, verb) {
  if (!p) return ''
  const reach = !p.commissionMonths ? 'każdej płatności'
    : p.commissionMonths === 1 ? 'Pakietu i pierwszej płatności subskrypcji' : `Pakietu i pierwszych ${p.commissionMonths} płatności subskrypcji`
  const discount = p.discountPercent ? ` Kupujący ma ${p.discountPercent}% zniżki na pierwszy miesiąc albo Pakiet.` : ''
  return `${verb} ${p.commissionPercent}% od ${reach}.${discount}`
}
