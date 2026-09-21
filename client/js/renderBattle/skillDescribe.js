export const skillMeta = {
    "확산" : {
        target: "대상: 적군 전원 (자동 지정)",
        detail: "적군 전원에게 동시에 피해를 입힙니다."
    },
    "침식" : {
        target: "대상: 적군 1인",
        detail: "지정 대상 1인에게 강한 피해를 입히며, 자신의 체력을 피해량에 더할 수 있습니다. <strong>단, 더할 수 있는 체력은 20 이하로 한정하며, 자신의 현재 잔여 체력 이상을 데미지로 더할 수 없습니다.</strong>"
    },
    "엄호" : {
        target: "대상: 아군 1인",
        detail: "지정 1인이 받는 피해를 해당 라운드에 크게 경감합니다."
    },
    "수호" : {
        target: "대상: 자신 제외 아군 전원 (자동 지정)",
        detail: "아군 전원이 입는 피해의 총합에서 일부를 경감하고 대신 받습니다. 이 스킬로 시전자의 체력이 0이 될 경우, <strong>남은 아군</strong>이 각각 [잔여 피해량의 평균]만큼 피해를 입습니다. 한 팀에서 두 명 이상의 캐릭터가 동시에 시전할 수 없습니다."
    },
    "성호" : {
        target: "대상: 자신 제외 아군 전원 (자동 지정)",
        detail: "자신을 제외한 아군 2인을 회복합니다."
    },
    "환희" : {
        target: "대상: 아군 1인",
        detail: "해당 라운드에 아군 대상 1인의 판정값을 일부 증가시키고, 이전에 차감된 <strong>[스킬 시전]</strong>의 선언 가능 횟수를 <strong>1회 보충</strong>합니다. 전투 당 횟수는 최대 이상으로 늘어날 수 없으며, [환희] 혹은 [낙화] 스킬을 가진 대상을 선택할 수 없습니다."
    },
    "낙화" : {
        target: "대상: 적군 1인",
        detail: "해당 라운드에 적군 대상 1인의 판정값을 감소시키고, <strong>[스킬 시전]</strong>을 선언할 수 없게 만듭니다. 해당 스킬은 <strong>선공 페이즈</strong>에서만 선언할 수 있으며, 대상의 판정값은 1 미만으로 감소할 수 없습니다."
    },
    "공격" : {
        target: "대상: 적군 1인",
        detail: "대상 1인에게 피해를 입힙니다."
    },
    "방어" : {
        target: "대상: 자신 혹은 아군 1인",
        detail: "대상 1인이 입는 피해를 경감합니다. <strong>아이기스가 아닌 캐릭터</strong>는 자신만 대상으로 선택할 수 있습니다."
    },
    "회복" : {
        target: "대상: 아군 1인",
        detail: "대상 1인의 체력을 회복합니다. <strong>카두케우스</strong>만 선언할 수 있으며, 최대 체력을 넘는 회복은 불가합니다."
    },
    "도주" : {
        target: "대상: 무관함",
        detail: "후공 페이즈에만 선언할 수 있습니다. 전체 팀원 중 한 명만 선언해도 전원이 도주를 시도합니다. 해당 라운드의 모든 아군 선언이 무효화 되며, 양 팀은 사망자를 제외한 스탯값 평균으로 판정합니다. 도주 선언팀의 판정값이 높거나 같으면 도주에 성공하며, 전투가 종료되고, 도주한 팀은 무조건 패배합니다."
    },
};

export function getSkillDescribe(skillName, roomState) {
    const meta = skillMeta[skillName];
    const uses = roomState.skillTable[skillName]?.uses;
    const usesText = (uses === null || uses === undefined) ? "무한" : `${uses}회`;

    return [`${usesText} • ${meta.target}`, meta.detail];
}