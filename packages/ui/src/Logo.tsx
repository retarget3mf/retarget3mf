/// <reference path="./assets.d.ts" />
import icon from './brand/icon.svg';

const iconUrl = typeof icon === 'string' ? icon : icon.src;
import styles from './Logo.module.css';

/** App icon plus the "Retarget3MF" wordmark (Claude Design, option 1d). */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className={styles.logo}>
      <img src={iconUrl} width={size} height={size} alt="" />
      <span className={styles.word}>Retarget<span className={styles.accent}>3MF</span></span>
    </span>
  );
}
