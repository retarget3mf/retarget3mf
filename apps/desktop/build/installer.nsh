; Gives the model sites' "Open in slicer" links back to the slicers that had them (saved by slicerLinks.ts).
!macro restoreSlicerLink SCHEME
  ReadRegStr $0 HKCU "Software\Retarget3MF\LinkHandlers" "${SCHEME}"
  StrCmp $0 "" +5
  StrCmp $0 "-" 0 +3
  DeleteRegKey HKCU "Software\Classes\${SCHEME}"
  Goto +2
  WriteRegStr HKCU "Software\Classes\${SCHEME}\shell\open\command" "" $0
!macroend

; An update runs the old uninstaller too; the links stay with Retarget3MF then.
!macro customUnInstall
  ${ifNot} ${isUpdated}
  !insertmacro restoreSlicerLink "bambustudio"
  !insertmacro restoreSlicerLink "bambustudioopen"
  !insertmacro restoreSlicerLink "bambusuite"
  !insertmacro restoreSlicerLink "crealityprintlink"
  !insertmacro restoreSlicerLink "snapmaker-orca"
  !insertmacro restoreSlicerLink "prusaslicer"
  DeleteRegKey HKCU "Software\Retarget3MF\LinkHandlers"
  ${endIf}
!macroend
