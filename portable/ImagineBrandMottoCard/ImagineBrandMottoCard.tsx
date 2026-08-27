import type {CSSProperties} from 'react';
import './ImagineBrandMottoCard.css';
import defaultLogo from './assets/imagine-lab-logo.png';

export type ImagineBrandMottoCardProps = {
  /** 使用目标项目侧边栏顶部的同一张 Logo；不传则使用包内默认 Logo。 */
  logoSrc?: string;
  brandName?: string;
  className?: string;
  /** 侧边栏收起时传入 true，卡片自动隐藏。 */
  collapsed?: boolean;
  /** 可覆盖尺寸和位置，如 {'--im-card-bottom': '82px'}。 */
  style?: CSSProperties;
};

export function ImagineBrandMottoCard({
  logoSrc = defaultLogo,
  brandName = 'Imagine Lab',
  className = '',
  collapsed = false,
  style,
}: ImagineBrandMottoCardProps) {
  return (
    <section
      className={`imagine-brand-motto-card${collapsed ? ' is-collapsed' : ''}${className ? ` ${className}` : ''}`}
      aria-label={`${brandName} 品牌宣言`}
      style={style}
    >
      <p className="imagine-brand-motto-card__copy">
        让想象力，<br />
        成为团队的生产力。
      </p>
      <span className="imagine-brand-motto-card__brand">
        <img src={logoSrc} alt={brandName} />
        <b>{brandName}</b>
      </span>
    </section>
  );
}

export default ImagineBrandMottoCard;
