import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { MembersComponent } from './components/members/members.component';
import { AccountsComponent } from './components/accounts/accounts.component';
import { PermissionsComponent } from './components/permissions/permissions.component';
import { DomainComponent } from './components/domain/domain.component';
import { DomainViewComponent } from './components/domain/domain-view/domain-view.component';

const routes: Routes = [
  {
    path: 'members',
    component: MembersComponent,
  },
  {
    path: 'accounts',
    component: AccountsComponent,
  },
  {
    path: 'permissions',
    component: PermissionsComponent,
  },
  {
    path: 'domain',
    component: DomainComponent,
  },
  {
    path: 'domain/:name',
    component: DomainViewComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
