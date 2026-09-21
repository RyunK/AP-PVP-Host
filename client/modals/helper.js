
export function arrowSelector(arrow, isOpen){
    if (arrow) arrow.innerHTML = isOpen ? 
    `<i class="fa-solid fa-caret-up" style="font-size: 0.8em"></i>` 
    : `<i class="fa-solid fa-caret-down " style="font-size: 0.8em"></i>`;
}