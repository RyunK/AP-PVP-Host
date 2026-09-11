// return할 모델에 대해서 정의함

export {};

declare global{
    interface Info {
        id: string;
        name: string;
        faction: string;
        useSkill: string;
        corVal: number;
        targets: Array;
    }

    interface DiceResult{
        criticalMultiplier: number;
        value: number;
        formula: string;
    }

    interface HpResult{

    }

    interface Calcs{
        info: Info;
        diceResult: DiceResult;
        hpResult: HpResult;
    }
}
