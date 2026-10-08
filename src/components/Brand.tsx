/** Logo: a miniature of the splash monogram, plus the wordmark. */
export default function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="logo-tile" aria-hidden="true"><b>B<span>.</span></b></div>
      <span className="wordmark">Budge</span>
    </div>
  )
}
