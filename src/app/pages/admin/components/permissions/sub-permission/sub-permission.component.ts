import { Component, Input } from '@angular/core';

@Component({
  selector: 'org-admin-permission-sub',
  templateUrl: './sub-permission.component.html',
  styleUrls: ['./sub-permission.component.less'],
})
export class SubPermissionComponent {
  @Input() title = '';
  @Input() description?: string = '';

  constructor() {}
}
