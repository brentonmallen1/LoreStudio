import { AlertTriangle, CheckCircle2, BookOpen } from "lucide-react";
import { useState } from "react";
import type { MICEViolation } from "../../types";
import MICEGuide from "../help/MICEGuide";
import styles from "./MICEValidation.module.css";

interface Props {
  violations: MICEViolation[];
}

export default function MICEValidation({ violations }: Props) {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <>
      {showGuide && <MICEGuide onClose={() => setShowGuide(false)} />}
      <div className={styles.wrap}>
        {violations.length === 0 ? (
          <div className={styles.ok}>
            <CheckCircle2 size={13} />
            <span>Thread nesting is valid — all MICE threads close in LIFO order.</span>
          </div>
        ) : (
          <div className={styles.violations}>
            {violations.map((v, i) => (
              <div key={i} className={styles.violation}>
                <AlertTriangle size={13} className={styles.violationIcon} />
                <p className={styles.violationMsg}>{v.message}</p>
              </div>
            ))}
          </div>
        )}
        <button className={styles.learnBtn} onClick={() => setShowGuide(true)}>
          <BookOpen size={11} />
          What is LIFO nesting?
        </button>
      </div>
    </>
  );
}
